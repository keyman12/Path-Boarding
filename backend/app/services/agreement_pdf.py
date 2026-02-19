"""
Generate Path Merchant Agreement PDF.
Uses Path brand colours: dark green (#297D2D) for titles, salmon pink (#FF5252) for highlights.
"""
import os
import textwrap
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# Path brand colours
PATH_GREEN = colors.HexColor("#297D2D")
PATH_SALMON = colors.HexColor("#FF5252")
PATH_BLACK = colors.HexColor("#1a1a1a")
PATH_GREY = colors.HexColor("#4a4a4a")


def _val(s: Optional[str]) -> str:
    """Return value or placeholder."""
    return (s or "").strip() or "—"


def _val_addr(s: Optional[str]) -> str:
    """Return value with newlines replaced by comma-space for PDF display."""
    v = (s or "").strip()
    if not v:
        return "—"
    return v.replace("\n", ", ").replace("\r", "")


def _format_uk_postcode(s: Optional[str]) -> str:
    """Format UK postcode: uppercase, space before last 3 chars (e.g. SS13QU -> SS1 3QU)."""
    v = (s or "").strip().upper().replace(" ", "")
    if len(v) >= 5:
        return v[:-3] + " " + v[-3:]
    return v or "—"


def _format_delivery_timeframe(s: Optional[str]) -> str:
    """Format delivery timeframe for display."""
    m = {
        "immediately": "Immediately",
        "within_7_days": "Within 7 days",
        "within_30_days": "Within 30 days",
        "over_30_days": "Over 30 days",
    }
    v = (s or "").strip().lower()
    return m.get(v, _val(s))


def _draw_header(c: canvas.Canvas, logo_path: Optional[str]) -> None:
    """Draw Path logo top left - larger, further left, one line lower from top."""
    x, y = 20, A4[1] - 62
    if logo_path and os.path.isfile(logo_path):
        try:
            c.drawImage(logo_path, x, y, width=130, height=36, preserveAspectRatio=True)
        except Exception:
            c.setFont("Helvetica-Bold", 18)
            c.setFillColor(PATH_GREEN)
            c.drawString(x, y + 8, "Path")
    else:
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(PATH_GREEN)
        c.drawString(x, y + 8, "Path")


FOOTER_Y = 30
FOOTER_MARGIN = 55  # Min y for content; footer + blank space above


def _draw_footer(c: canvas.Canvas, page_num: int) -> None:
    """Draw footer with copyright line and page numbers. Blank space above."""
    c.setFont("Helvetica", 8)
    c.setFillColor(PATH_GREY)
    c.drawString(40, FOOTER_Y, "© Path2ai.tech. All rights reserved.")
    c.drawRightString(A4[0] - 40, FOOTER_Y, f"Page {page_num}")


# Line heights: 9pt font needs ~12pt; extra padding between field rows
LINE_HEIGHT_FIELD = 16
LINE_HEIGHT_SECTION = 10
LINE_HEIGHT_INTRO = 11   # 9pt intro text - needs proper paragraph spacing
LINE_HEIGHT_CONSENT = 11  # 8pt consent - was 5, caused page 2 overlap


def _section_title(c: canvas.Canvas, y: float, text: str) -> float:
    """Draw section title in dark green. Extra line space below for readability."""
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(PATH_GREEN)
    c.drawString(LABEL_COL, y, text)
    return y - LINE_HEIGHT_SECTION - LINE_HEIGHT_FIELD


# Two-column layout: labels left, values right. Left justified.
LABEL_COL = 40
VALUE_COL = 280  # 50% further than original 200
# Signature block: align with DocuSign SignHere tab (anchor + x_offset)
SIGNATURE_VALUE_COL = 305


def _field_line(
    c: canvas.Canvas, y: float, label: str, value: str, indent: int = 0, value_x: Optional[float] = None
) -> float:
    """Draw label in col 1, value in col 2. Both left justified. Optional value_x overrides value column."""
    lx = LABEL_COL + indent
    vx = value_x if value_x is not None else (VALUE_COL + indent)
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_GREY)
    c.drawString(lx, y, f"{label}:")
    c.setFillColor(PATH_BLACK)
    val = value[:80] if len(value) > 80 else value
    c.drawString(vx, y, val)
    return y - LINE_HEIGHT_FIELD


def generate_agreement_pdf(
    output_path: str,
    contact: Any,
    merchant: Any,
    invite: Any,
    product_package: Any,
    fee_schedule: Any,
) -> str:
    """
    Generate the Path Merchant Agreement PDF.
    Returns the path to the generated file.
    """
    logo_path = Path(__file__).resolve().parent.parent.parent / "static" / "path-logo.png"
    if not logo_path.exists():
        logo_path = None
    else:
        logo_path = str(logo_path)

    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin_bottom = FOOTER_MARGIN
    y = height - 50
    page_num = 1

    def maybe_new_page():
        nonlocal y, page_num
        if y < margin_bottom + 110:
            _draw_footer(c, page_num)
            c.showPage()
            page_num += 1
            _draw_header(c, logo_path)
            # Page 2+: extra space between logo and next heading
            y = height - 84

    def ensure_section_fits(num_lines: int) -> None:
        """If section won't fit, start new page. Prevents sections split across pages."""
        space_needed = num_lines * LINE_HEIGHT_FIELD + LINE_HEIGHT_SECTION + LINE_HEIGHT_FIELD
        if y - space_needed < margin_bottom + 110:
            maybe_new_page()

    # Header with logo
    _draw_header(c, logo_path)
    y -= 50

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(PATH_GREEN)
    c.drawString(LABEL_COL, y, "Path Application Form")
    y -= 20
    c.setFont("Helvetica-Bold", 12)
    c.drawString(LABEL_COL, y, "Summary of Merchant Agreement")
    y -= 24

    # Intro paragraph
    intro = (
        "By filling out and signing this application the Merchant requests that Path enter into an agreement "
        "with the Merchant for payment processing services to acquire the Merchant's Transactions and process them "
        "for clearing and settlement purposes, through an acquiring bank as selected by Path.\n\n"
        "This application, the general Terms and Conditions and the Merchant Terms and Conditions shall collectively "
        "form the Merchant Agreement between the Merchant and the Path, giving permission for Path to provide payment "
        "processing services. By signing this application, the Merchant agrees to the terms of the Merchant Agreement."
    )
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_BLACK)
    for para in intro.split("\n\n"):
        for line in textwrap.wrap(para, width=90):
            maybe_new_page()
            c.drawString(LABEL_COL, y, line)
            y -= LINE_HEIGHT_INTRO
        y -= 12
    y -= 16

    # Applicant Details
    ensure_section_fits(10)
    y = _section_title(c, y, "Applicant Details")
    applicant_name = f"{_val(contact.legal_first_name)} {_val(contact.legal_last_name)}".strip() or "—"
    y = _field_line(c, y, "Applicant Legal Name", applicant_name)
    y = _field_line(c, y, "Date of Birth", _val(contact.date_of_birth))
    y = _field_line(c, y, "Email Address", _val(contact.email))
    phone = f"{_val(contact.phone_country_code)} {_val(contact.phone_number)}".strip() or "—"
    y = _field_line(c, y, "Telephone Number", phone)
    y -= LINE_HEIGHT_FIELD
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(PATH_GREY)
    c.drawString(LABEL_COL, y, "Address:")
    y -= LINE_HEIGHT_FIELD
    y = _field_line(c, y, "Country", _val(contact.address_country))
    y = _field_line(c, y, "Street", _val(contact.address_line1))
    if contact.address_line2:
        y = _field_line(c, y, "Address 2", _val(contact.address_line2))
    y = _field_line(c, y, "Town", _val(contact.address_town))
    y = _field_line(c, y, "Post Code", _format_uk_postcode(contact.address_postcode))
    y -= LINE_HEIGHT_FIELD

    # Company Details
    ensure_section_fits(14)
    y = _section_title(c, y, "Company Details")
    company_name = _val(contact.company_name) or _val(merchant.trading_name) or _val(invite.merchant_name) or "—"
    y = _field_line(c, y, "Company Name", company_name)
    y = _field_line(c, y, "Company Support Email Address", _val(contact.customer_support_email) or _val(contact.email))
    y = _field_line(c, y, "Company Website", _val(contact.customer_websites))
    y = _field_line(c, y, "Incorporated In", _val(contact.company_incorporated_in) or "United Kingdom")
    y = _field_line(c, y, "Incorporation Date", _val(contact.company_incorporation_date))
    y = _field_line(c, y, "Company Number", _val(contact.company_number))
    y = _field_line(c, y, "VAT Number", _val(contact.vat_number))
    y = _field_line(c, y, "Registered Office", _val_addr(contact.company_registered_office))
    y = _field_line(c, y, "Industry (SIC) - As Listed By Companies House", _val(contact.company_industry_sic))
    y = _field_line(c, y, "Industry (MCC) and Description", _val(contact.customer_industry))
    y = _field_line(c, y, "Estimated Monthly Card Volume", _val(contact.estimated_monthly_card_volume))
    y = _field_line(c, y, "Average Transaction Value", _val(contact.average_transaction_value))
    y = _field_line(c, y, "Customers Receive Their Goods", _format_delivery_timeframe(contact.delivery_timeframe))
    y -= LINE_HEIGHT_FIELD

    # Company Directors
    ensure_section_fits(11)
    y = _section_title(c, y, "Company Directors")
    y = _field_line(c, y, "Full Legal Name (1st Director)", applicant_name)
    y = _field_line(c, y, "Nationality", "—")
    y = _field_line(c, y, "Date of Birth", _val(contact.date_of_birth))
    y = _field_line(c, y, "Residential Address", "")
    y = _field_line(c, y, "Address 1", _val(contact.address_line1))
    y = _field_line(c, y, "Address 2", _val(contact.address_line2) or "—")
    y = _field_line(c, y, "Town", _val(contact.address_town))
    y = _field_line(c, y, "Post Code", _format_uk_postcode(contact.address_postcode))
    y = _field_line(c, y, "Company (If Ownership via Another Company)", "—")
    y = _field_line(c, y, "Ownership Percentage", "—")
    y -= LINE_HEIGHT_FIELD

    # Beneficial Owners
    ensure_section_fits(4)
    y = _section_title(c, y, "Beneficial Owners")
    y = _field_line(c, y, "Nationality", "—")
    y = _field_line(c, y, "Date of Birth", "—")
    y = _field_line(c, y, "Residential Address", "—")
    y -= LINE_HEIGHT_FIELD

    # Payout Details
    ensure_section_fits(10)
    y = _section_title(c, y, "Payout Details")
    y = _field_line(c, y, "Bank Account Name", _val(contact.bank_account_name))
    y = _field_line(c, y, "Country", _val(contact.bank_country))
    y = _field_line(c, y, "Currency", _val(contact.bank_currency))
    sort_code = _val(contact.bank_sort_code) if contact.bank_sort_code else "—"
    acct_num = _val(contact.bank_account_number) if contact.bank_account_number else "—"
    iban_val = _val(contact.bank_iban) if contact.bank_iban else "—"
    y = _field_line(c, y, "Sort Code", sort_code)
    y = _field_line(c, y, "Account Number", acct_num)
    y = _field_line(c, y, "IBAN", iban_val)
    y = _field_line(c, y, "Payment Schedule", "Transaction + 2 days")
    y -= LINE_HEIGHT_FIELD

    # Product and Fee Schedule
    ensure_section_fits(15)
    y = _section_title(c, y, "Product and Fee Schedule")
    # Products only (terminals, SoftPOS, PaybyLink, QR) - exclude acquiring/other_fee items
    _PRODUCT_TYPES = {"physical_pos", "ecomm"}
    _PRODUCT_CODES = {"pax_a920_pro", "verifone_p400", "softpos", "payby_link", "virtual_terminal"}
    products_shown = 0
    if product_package and hasattr(product_package, "items"):
        for item in product_package.items:
            cat = item.get("catalog_product") if isinstance(item, dict) else getattr(item, "catalog_product", None)
            ptype = getattr(cat, "product_type", None) if cat else None
            pcode = getattr(cat, "product_code", None) if cat else None
            if ptype not in _PRODUCT_TYPES and pcode not in _PRODUCT_CODES:
                continue
            name = (getattr(cat, "name", None) if cat else None) or (
                item.get("product_name", "") if isinstance(item, dict) else getattr(item, "product_name", "")
            )
            cfg = item.get("config") if isinstance(item, dict) else getattr(item, "config", None)
            cfg = cfg if isinstance(cfg, dict) else {}
            if isinstance(cfg, dict):
                if "pos_price_per_month" in cfg:
                    price = f"£{float(cfg.get('pos_price_per_month', 0) or 0):.2f}/month"
                elif "pos_monthly_service" in cfg:
                    price = f"£{float(cfg.get('pos_monthly_service', 0) or 0):.2f}/month"
                elif "amount" in cfg:
                    amt = cfg.get("amount", 0)
                    unit = "link" if (name and "link" in str(name).lower()) else "transaction"
                    price = f"£{float(amt or 0):.2f} per {unit}"
                elif "pct" in cfg:
                    price = f"{float(cfg.get('pct', 0) or 0)}%"
                else:
                    price = "—"
            else:
                price = "—"
            y = _field_line(c, y, str(name) if name else "Product", price)
            products_shown += 1
    if products_shown == 0:
        y = _field_line(c, y, "Products", "—")
    y = _field_line(c, y, "Card Acceptance Fees", "Visa, Mastercard, Maestro, Diners")
    y -= LINE_HEIGHT_FIELD
    # Card fees only from fee_schedule (debit, credit, premium, etc.) - explicit order
    _FEE_ORDER = [
        "debit", "credit", "premium", "cnp", "cross_border",
        "auth_fee", "refund_fee", "three_d_secure_fee"
    ]
    _FEE_LABELS = {
        "debit": "Debit Card",
        "credit": "Credit Card",
        "premium": "Premium Card",
        "cnp": "Card Not Present",
        "cross_border": "Cross Border",
        "auth_fee": "Authorisation Fee",
        "refund_fee": "Refund Fee",
        "three_d_secure_fee": "3D Secure Fee",
    }
    if fee_schedule and hasattr(fee_schedule, "rates") and fee_schedule.rates:
        rates = fee_schedule.rates
        for k in _FEE_ORDER:
            if k not in rates:
                continue
            v = rates[k]
            if isinstance(v, dict):
                pct = v.get("min_pct") or v.get("pct")
                amt = v.get("min_amount") or v.get("amount")
                if pct is not None:
                    val = f"{float(pct)}%"
                elif amt is not None:
                    val = f"£{float(amt):.2f}"
                else:
                    val = "—"
            else:
                val = "—"
            label = _FEE_LABELS.get(k, k.replace("_", " ").title())
            y = _field_line(c, y, label, val)
    y = _field_line(c, y, "Chargeback Fee", "£25")
    y -= LINE_HEIGHT_FIELD

    # Merchant's Consent
    ensure_section_fits(3)
    y = _section_title(c, y, "Merchant's Consent")
    consent_text = (
        "By signing this application, the Merchant confirms that it understands and accepts that in order to evaluate its application "
        "Path will perform several checks, including politically exposed person (PEP)/ sanction screening and an electronic credit "
        "check and in order to fulfil its legal obligation under anti-money laundering regulations. For this purpose, Path will use "
        "the service of Sumsub or a similar third-party service provider (the \"service provider\"). By signing this application, the "
        "Merchant authorises Path to undertake searches with the service provider for the purpose of both verifying the "
        "Merchant's identity and that of its beneficial owners, during the application review and at any time during the term of the "
        "business relationship. The Merchant confirms on behalf of itself and its beneficial owners and directors that it is aware that "
        "a record of the searches and results thereof may be retained by Path. The Merchant also acknowledges that should "
        "further documentation be required to support verification checks, Path may request via a secure system for ID "
        "documentation such as a Passport or Driving Licence copy.\n\n"
        "The Merchant confirms that they accept the pricing and membership rates as defined in this form and acknowledges "
        "that in the event of any Chargebacks these will be charged at a fee of £25 per Chargeback.\n\n"
        "In terms of applicable data protection laws and regulations, Path will process the above data and any other data which "
        "Merchant may subsequently give to Path or which has been obtained by Path independently for this application, "
        "for the following purposes, namely:\n"
        "• To be able to process this application and provide its services;\n"
        "• For due diligence procedures, internal assessment, risk assessment and analysis;\n"
        "• For the detection and prevention of fraud and other criminal activity which Path is bound to report;\n"
        "• To comply with any laws, rules, or regulations imposed on Path by any relevant authority, regulator or acquiring bank;\n"
        "I consent to the processing of such data for the purpose specified on this application and consent to the disclosure of "
        "information given above to, and to the exchange thereof with the acquiring bank when required. I understand that I have a "
        "right of access to, and the right to rectify, the personal data.\n"
        "I represent that:\n"
        "• all the information I have given on this application form is true, complete and accurate and properly reflects the Merchant's business;\n"
        "• persons whose personal data is disclosed in this application have provided their explicit consent to such use and processing;\n"
        "• I am duly authorised to bind the Merchant to the terms of the Merchant Agreement.\n"
        "Path reserves the right to request more information/documentation during onboarding or during the term of the business relationship."
    )
    # Consent text: same format as intro (9pt, same wrap, same line height)
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_BLACK)
    for para in consent_text.split("\n\n"):
        para_flat = para.replace("\n", " ")
        for line in textwrap.wrap(para_flat, width=90):
            maybe_new_page()
            c.setFont("Helvetica", 9)
            c.setFillColor(PATH_BLACK)
            c.drawString(LABEL_COL, y, line)
            y -= LINE_HEIGHT_INTRO
        y -= 12
    y -= 16

    # Signature block – invisible anchor /sn1/ for DocuSign SignHere, extra space before Print Name
    ensure_section_fits(6)
    y = _section_title(c, y, "Signed for and on Behalf of the Merchant*")
    # Merchant Signature: draw label, then invisible anchor for DocuSign (white on white)
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_GREY)
    c.drawString(LABEL_COL, y, "Merchant Signature:")
    c.setFillColor(colors.white)
    c.drawString(SIGNATURE_VALUE_COL, y, "/sn1/")
    c.setFillColor(PATH_BLACK)
    y -= LINE_HEIGHT_FIELD
    y -= 28  # Extra space between signature area and printed name
    # Print Name and Date: align with signature box (SIGNATURE_VALUE_COL)
    y = _field_line(c, y, "Print Name and Title", applicant_name + " / Director", value_x=SIGNATURE_VALUE_COL)
    # Date: invisible [Date] anchor for DocuSign DateSigned (white so it doesn't overlap the auto-populated date)
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_GREY)
    c.drawString(LABEL_COL, y, "Date:")
    c.setFillColor(colors.white)
    c.drawString(SIGNATURE_VALUE_COL, y, "[Date]")
    c.setFillColor(PATH_BLACK)
    y -= LINE_HEIGHT_FIELD

    _draw_footer(c, page_num)
    c.save()
    return output_path


def _blank_objects() -> tuple[Any, Any, Any, Any, Any]:
    """Create minimal mock objects with empty values for blank template generation."""
    contact = SimpleNamespace(
        legal_first_name="",
        legal_last_name="",
        date_of_birth=None,
        address_country=None,
        address_line1=None,
        address_line2=None,
        address_town=None,
        address_postcode=None,
        email=None,
        phone_country_code=None,
        phone_number=None,
        company_name=None,
        customer_support_email=None,
        customer_websites=None,
        company_incorporated_in=None,
        company_incorporation_date=None,
        company_number=None,
        vat_number=None,
        company_registered_office=None,
        company_industry_sic=None,
        customer_industry=None,
        estimated_monthly_card_volume=None,
        average_transaction_value=None,
        delivery_timeframe=None,
        bank_account_name=None,
        bank_country=None,
        bank_currency=None,
        bank_sort_code=None,
        bank_account_number=None,
        bank_iban=None,
    )
    merchant = SimpleNamespace(trading_name=None)
    invite = SimpleNamespace(merchant_name=None)
    return contact, merchant, invite, None, None


def add_signature_block_to_services_agreement(
    source_path: str,
    output_path: str,
    applicant_name: str,
) -> str:
    """
    Append a signature block page to the Services Agreement PDF.
    Same layout as the Path Agreement: Signed for and on Behalf of the Merchant,
    with invisible anchors /sn2/ and [Date2] for DocuSign.
    Returns the output path.
    """
    from pypdf import PdfReader, PdfWriter
    from io import BytesIO

    if not os.path.isfile(source_path):
        raise FileNotFoundError(f"Services Agreement not found: {source_path}")

    # Create signature block page with reportlab
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    page_num = 1  # This will be the last page

    logo_path = Path(__file__).resolve().parent.parent.parent / "static" / "path-logo.png"
    logo_str = str(logo_path) if logo_path.exists() else None
    _draw_header(c, logo_str)
    y = height - 100

    # Signature block – same as Path Agreement but with /sn2/ and [Date2]
    y = _section_title(c, y, "Signed for and on Behalf of the Merchant*")
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_GREY)
    c.drawString(LABEL_COL, y, "Merchant Signature:")
    c.setFillColor(colors.white)
    c.drawString(SIGNATURE_VALUE_COL, y, "/sn2/")
    c.setFillColor(PATH_BLACK)
    y -= LINE_HEIGHT_FIELD
    y -= 28
    y = _field_line(c, y, "Print Name and Title", applicant_name + " / Director", value_x=SIGNATURE_VALUE_COL)
    c.setFont("Helvetica", 9)
    c.setFillColor(PATH_GREY)
    c.drawString(LABEL_COL, y, "Date:")
    c.setFillColor(colors.white)
    c.drawString(SIGNATURE_VALUE_COL, y, "[Date2]")
    c.setFillColor(PATH_BLACK)
    y -= LINE_HEIGHT_FIELD

    _draw_footer(c, page_num)
    c.save()
    buffer.seek(0)

    # Merge: original Services Agreement + signature page
    reader_orig = PdfReader(source_path)
    reader_sig = PdfReader(buffer)
    writer = PdfWriter()
    for page in reader_orig.pages:
        writer.add_page(page)
    writer.add_page(reader_sig.pages[0])
    with open(output_path, "wb") as f:
        writer.write(f)

    return output_path


def generate_blank_agreement_pdf(output_path: str) -> str:
    """
    Generate a blank Path Merchant Agreement PDF template with all values as "—".
    Use this to review layout and spacing before filling with real data.
    """
    contact, merchant, invite, product_package, fee_schedule = _blank_objects()
    return generate_agreement_pdf(
        output_path=output_path,
        contact=contact,
        merchant=merchant,
        invite=invite,
        product_package=product_package,
        fee_schedule=fee_schedule,
    )
