#!/usr/bin/env python3
"""
Microsoft 365 Copilot — Complete Cheat Sheet
Rebuilt PDF: compact layout (no excess whitespace) + real clickable TOC
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

# ── Page geometry ─────────────────────────────────────────────────────────────
W, H = letter
ML = MR = 0.72 * inch
MT = 0.80 * inch
MB = 0.60 * inch
CW = W - ML - MR   # content width

# ── Palette ───────────────────────────────────────────────────────────────────
DARK_NAVY    = HexColor('#17375E')
MED_BLUE     = HexColor('#2E75B6')
LIGHT_BG     = HexColor('#DEEAF1')
PROMPT_BLUE  = HexColor('#1F4E79')
TOC_BLUE     = HexColor('#2563A8')
GOLD         = HexColor('#BF8F00')
BODY_CLR     = HexColor('#1A1A1A')
ALT_ROW      = HexColor('#EBF4FB')
NOTE_BG      = HexColor('#FFFDE7')
NOTE_BORDER  = HexColor('#BF8F00')
GRAY_LINE    = HexColor('#CCCCCC')
TABLE_HDR    = HexColor('#17375E')
SUBSEC_BG    = HexColor('#EBF4FB')
STEP_BG      = HexColor('#17375E')
TBL_ALT      = HexColor('#F0F7FC')

FOOTER_TXT = (
    "Updated June 2026 — Includes Copilot vs Cowork comparison, "
    "Teams recording guide, and model engine reference"
)
HEADER_TXT = "Microsoft 365 Copilot — Complete Cheat Sheet"

# ── Styles ────────────────────────────────────────────────────────────────────
def S(name, **kw):
    return ParagraphStyle(name, **kw)

BODY      = S('body',      fontName='Helvetica',      fontSize=9.5,  leading=14,   textColor=BODY_CLR, spaceBefore=2, spaceAfter=2)
BODY_J    = S('body_j',   fontName='Helvetica',      fontSize=9.5,  leading=14,   textColor=BODY_CLR, alignment=TA_JUSTIFY)
BULLET    = S('bullet',    fontName='Helvetica',      fontSize=9.5,  leading=13,   textColor=BODY_CLR, leftIndent=12, firstLineIndent=0, spaceBefore=1, spaceAfter=1, bulletIndent=0)
PROMPT    = S('prompt',    fontName='Helvetica-Oblique', fontSize=9, leading=13,   textColor=PROMPT_BLUE, leftIndent=14, spaceBefore=1, spaceAfter=1)
SEC_HDR   = S('sec_hdr',  fontName='Helvetica-Bold', fontSize=17,   leading=22,   textColor=white, alignment=TA_LEFT)
SUBSEC    = S('subsec',   fontName='Helvetica-Bold', fontSize=10.5, leading=14,   textColor=DARK_NAVY)
TOC_HDR   = S('toc_hdr',  fontName='Helvetica-Bold', fontSize=11.5, leading=15,   textColor=DARK_NAVY)
TOC_ITEM  = S('toc_item', fontName='Helvetica',      fontSize=10,   leading=15,   textColor=TOC_BLUE)
TOC_NEW   = S('toc_new',  fontName='Helvetica',      fontSize=10,   leading=15,   textColor=GOLD)
COVER1    = S('cover1',   fontName='Helvetica-Bold', fontSize=28,   leading=34,   textColor=white, alignment=TA_CENTER)
COVER2    = S('cover2',   fontName='Helvetica-Bold', fontSize=22,   leading=28,   textColor=white, alignment=TA_CENTER)
COVER3    = S('cover3',   fontName='Helvetica',      fontSize=10,   leading=14,   textColor=white, alignment=TA_CENTER)
NOTE_S    = S('note',     fontName='Helvetica-Oblique', fontSize=8.5, leading=12, textColor=BODY_CLR)
SMALL     = S('small',    fontName='Helvetica',      fontSize=8,    leading=11,   textColor=HexColor('#555555'))
TBL_HDR_S = S('tbl_hdr', fontName='Helvetica-Bold', fontSize=9,    leading=12,   textColor=white, alignment=TA_CENTER)
TBL_CELL  = S('tbl_cell', fontName='Helvetica',      fontSize=8.5,  leading=12,   textColor=BODY_CLR)
TBL_CELL_B= S('tbl_cell_b', fontName='Helvetica-Bold', fontSize=8.5, leading=12, textColor=TOC_BLUE)
TBL_CELL_I= S('tbl_cell_i', fontName='Helvetica-Oblique', fontSize=8.5, leading=12, textColor=BODY_CLR)
ENG_LBL   = S('eng_lbl', fontName='Helvetica-Bold', fontSize=9,    leading=12,   textColor=BODY_CLR)
ENG_DESC  = S('eng_desc', fontName='Helvetica',      fontSize=8.5,  leading=12,   textColor=BODY_CLR)
ENG_TAG   = S('eng_tag',  fontName='Helvetica-Bold', fontSize=8.5,  leading=12,   textColor=BODY_CLR, alignment=TA_CENTER)
STEP_BODY = S('step_body', fontName='Helvetica',     fontSize=9,    leading=13,   textColor=BODY_CLR)
STEP_TTL  = S('step_ttl', fontName='Helvetica-Bold', fontSize=9.5,  leading=13,   textColor=BODY_CLR)
WH_HDR    = S('wh_hdr',  fontName='Helvetica-Bold', fontSize=9.5,  leading=13,   textColor=TOC_BLUE)
WH_ITEM   = S('wh_item', fontName='Helvetica',      fontSize=9,    leading=13,   textColor=BODY_CLR)
RECAP_LBL = S('recap_lbl', fontName='Helvetica-Bold', fontSize=9,  leading=12,   textColor=white)
LINK_BLUE = S('link_blue', fontName='Helvetica',    fontSize=9.5,  leading=13,   textColor=TOC_BLUE)
SUB_INTRO = S('sub_intro', fontName='Helvetica',    fontSize=9.5,  leading=14,   textColor=BODY_CLR, spaceBefore=3, spaceAfter=3)


# ── Custom Flowables ──────────────────────────────────────────────────────────

class SectionHeader(Flowable):
    """Full-width dark navy section header box with white title text."""
    def __init__(self, number, title, anchor=None):
        Flowable.__init__(self)
        self.number = number
        self.title  = title
        self.anchor = anchor
        self.width  = CW
        self.height = 34

    def draw(self):
        c = self.canv
        c.saveState()
        if self.anchor:
            c.bookmarkPage(self.anchor)
            c.addOutlineEntry(f"{self.number}. {self.title}", self.anchor, level=0)
        c.setFillColor(DARK_NAVY)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 16)
        c.drawString(10, 10, f"{self.number}. {self.title}")
        c.restoreState()

    def wrap(self, availW, availH):
        self.width = availW
        return (availW, self.height)


class SubsectionHeader(Flowable):
    """Light blue subsection header with dark navy bold text and top border."""
    def __init__(self, title):
        Flowable.__init__(self)
        self.title  = title
        self.width  = CW
        self.height = 24

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(SUBSEC_BG)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setStrokeColor(MED_BLUE)
        c.setLineWidth(1.5)
        c.line(0, self.height, self.width, self.height)
        c.setFillColor(DARK_NAVY)
        c.setFont('Helvetica-Bold', 10.5)
        c.drawString(8, 7, f"✶ {self.title}")
        c.restoreState()

    def wrap(self, availW, availH):
        self.width = availW
        return (availW, self.height)


class CoverTitleBlock(Flowable):
    """Dark navy title block for the cover page."""
    def __init__(self):
        Flowable.__init__(self)
        self.width  = CW
        self.height = 148

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(DARK_NAVY)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        # Line 1
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 26)
        c.drawCentredString(self.width / 2, 106, "Microsoft 365 Copilot")
        # Line 2
        c.setFont('Helvetica-Bold', 20)
        c.drawCentredString(self.width / 2, 76, "Complete Cheat Sheet")
        # Subtitle
        c.setFont('Helvetica', 9.5)
        c.drawCentredString(self.width / 2, 52, "A Comprehensive Guide with Examples for Every Feature")
        # Update line
        c.setFont('Helvetica', 9)
        c.drawCentredString(self.width / 2, 32,
            "Updated June 2026 — Includes Engine Reference, Copilot vs Cowork & Teams Recording Guide")
        c.restoreState()

    def wrap(self, availW, availH):
        self.width = availW
        return (availW, self.height)


class NoteBox(Flowable):
    """Yellow note/tip box with left gold border."""
    def __init__(self, text, width=None):
        Flowable.__init__(self)
        self._text = text
        self._w    = width or CW
        self._style = S('note_inner', fontName='Helvetica-Oblique', fontSize=8.5,
                        leading=13, textColor=BODY_CLR)

    def wrap(self, availW, availH):
        self._w = availW
        inner = availW - 28
        p = Paragraph(self._text, self._style)
        _, h = p.wrap(inner, availH)
        self._h = h + 14
        return (availW, self._h)

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(NOTE_BG)
        c.rect(0, 0, self._w, self._h, fill=1, stroke=0)
        c.setStrokeColor(NOTE_BORDER)
        c.setLineWidth(2.5)
        c.line(0, 0, 0, self._h)
        c.setFillColor(NOTE_BORDER)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(8, self._h - 12, "■")
        p = Paragraph(self._text, self._style)
        p.wrap(self._w - 22, self._h)
        p.drawOn(c, 20, 7)
        c.restoreState()


class Anchor(Flowable):
    """Invisible flowable that sets a named PDF destination."""
    def __init__(self, name, outline_title=None, level=0):
        Flowable.__init__(self)
        self.name = name
        self.outline_title = outline_title
        self.level = level
        self.width = self.height = 0

    def draw(self):
        self.canv.bookmarkPage(self.name)
        if self.outline_title:
            self.canv.addOutlineEntry(self.outline_title, self.name, level=self.level)

    def wrap(self, availW, availH):
        return (0, 0)


# ── Page template (header + footer) ──────────────────────────────────────────

class CheatSheetDoc(BaseDocTemplate):
    def __init__(self, filename):
        BaseDocTemplate.__init__(self, filename,
            pagesize=letter,
            leftMargin=ML, rightMargin=MR,
            topMargin=MT, bottomMargin=MB)
        frame = Frame(ML, MB, CW, H - MT - MB, id='main')
        self.addPageTemplates([PageTemplate(id='main', frames=[frame],
                                            onPage=self._draw_chrome)])
        self._page_count_placeholder = []

    def _draw_chrome(self, canv, doc):
        canv.saveState()
        # Header
        canv.setFont('Helvetica-Bold', 7.5)
        canv.setFillColor(DARK_NAVY)
        canv.drawString(ML, H - 0.45 * inch, HEADER_TXT)
        canv.setFont('Helvetica', 7.5)
        canv.drawRightString(W - MR, H - 0.45 * inch, f"Page {doc.page}")
        canv.setStrokeColor(GRAY_LINE)
        canv.setLineWidth(0.5)
        canv.line(ML, H - 0.52 * inch, W - MR, H - 0.52 * inch)
        # Footer
        canv.setFont('Helvetica', 6.8)
        canv.setFillColor(HexColor('#666666'))
        canv.drawCentredString(W / 2, 0.35 * inch, FOOTER_TXT)
        canv.line(ML, 0.50 * inch, W - MR, 0.50 * inch)
        canv.restoreState()


# ── Helper builders ───────────────────────────────────────────────────────────

def sp(pts=4):
    return Spacer(1, pts)

def bullet_line(text, style=PROMPT):
    return Paragraph(f'<font color="#17375E">■</font>  {text}', style)

def std_bullet(text):
    return Paragraph(f'•  {text}', BULLET)

def bold_bullet(label, rest):
    return Paragraph(f'•  <b>{label}</b> {rest}', BULLET)

def subsection(title, items, intro=None):
    """Returns a KeepTogether block: subsection header + optional intro + items."""
    parts = [sp(4), SubsectionHeader(title)]
    if intro:
        parts.append(Paragraph(intro, SUB_INTRO))
    for itm in items:
        parts.append(itm)
    parts.append(sp(2))
    return KeepTogether(parts)

def section_header(num, title, anchor):
    return [sp(6), SectionHeader(num, title, anchor), sp(6)]


# ── TOC page ─────────────────────────────────────────────────────────────────

TOC_ENTRIES = [
    (1,  "sec1",  "What Is Microsoft 365 Copilot?",                     False),
    (2,  "sec2",  "Copilot in Word",                                     False),
    (3,  "sec3",  "Copilot in Excel",                                    False),
    (4,  "sec4",  "Copilot in Outlook",                                  False),
    (5,  "sec5",  "Copilot in Teams",                                    False),
    (6,  "sec6",  "Copilot in PowerPoint",                               False),
    (7,  "sec7",  "Copilot Chat (Business Chat)",                        False),
    (8,  "sec8",  "Copilot in OneDrive / SharePoint",                    False),
    (9,  "sec9",  "Prompt Engineering Best Practices",                   False),
    (10, "sec10", "Advanced Use Cases &amp; Workflows",                  False),
    (11, "sec11", "Quick Reference Table (with Engine Guide)",           False),
    (12, "sec12", "NEW: Microsoft 365 Copilot vs. Copilot Cowork",       True),
    (13, "sec13", "NEW: How to Record Meetings in Teams with Copilot",   True),
]

def build_toc():
    elems = []
    elems.append(CoverTitleBlock())
    elems.append(sp(18))

    elems.append(Paragraph(
        "Table of Contents — click any section to jump directly to it",
        TOC_HDR))
    elems.append(sp(6))

    toc_rows = []
    for num, anchor, title, is_new in TOC_ENTRIES:
        style = TOC_NEW if is_new else TOC_ITEM
        color = "#BF8F00" if is_new else "#2563A8"
        row = [
            Paragraph(f'<font color="{color}"><b>{num}.</b></font>', TOC_ITEM),
            Paragraph(f'<link destination="{anchor}" color="{color}">{title}</link>', style),
        ]
        toc_rows.append(row)

    toc_table = Table(toc_rows, colWidths=[0.38 * inch, CW - 0.38 * inch],
                      hAlign='LEFT')
    toc_table.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS',(0, 0), (-1, -1), [white, ALT_ROW]),
        ('LINEBELOW', (0, -3), (-1, -3), 1, HexColor('#E8A000')),
        ('BACKGROUND', (0, -2), (-1, -1), HexColor('#FFF8E7')),
    ]))
    elems.append(toc_table)
    elems.append(sp(12))
    elems.append(NoteBox(
        "■  This PDF has a clickable Table of Contents and section bookmarks. "
        "In any PDF viewer, click a section title above to jump to that page instantly."
    ))
    return elems


# ── Section content builders ──────────────────────────────────────────────────

def build_sec1():
    e = []
    e += section_header(1, "What Is Microsoft 365 Copilot?", "sec1")
    e.append(Paragraph(
        "Microsoft 365 Copilot is an AI-powered assistant deeply integrated into the M365 apps "
        "you already use — Word, Excel, PowerPoint, Outlook, Teams, and more. It combines "
        "large language models (LLMs) with your organization’s data in Microsoft Graph "
        "(emails, files, meetings, chats, contacts) to turn natural language into productivity.",
        BODY_J))
    e.append(sp(6))
    e.append(subsection("How It Works", [
        std_bullet("You type a natural language prompt (like asking a question or giving an instruction)."),
        std_bullet("Copilot uses Microsoft Graph to pull relevant data from your emails, files, calendar, and chats."),
        std_bullet("It processes the prompt through a large language model (GPT-5 family or Claude, depending on task) hosted in Azure."),
        std_bullet("Results are returned inside the app you’re working in — no context switching."),
        std_bullet("All responses respect your organization’s existing security and permissions."),
    ]))
    e.append(subsection("Where Copilot Lives", [
        bold_bullet("In-App:", "Word, Excel, PowerPoint, Outlook, Teams, OneNote, Loop, OneDrive, SharePoint"),
        bold_bullet("Standalone Chat:", "microsoft365.com/chat — cross-app queries across your entire M365 data"),
        bold_bullet("Power Platform:", "Power Automate, Copilot Studio, Power Apps"),
        bold_bullet("Windows:", "Copilot integrated into the Windows taskbar for quick access"),
    ]))
    return e


def build_sec2():
    e = []
    e += section_header(2, "Copilot in Word", "sec2")
    e.append(Paragraph(
        "Copilot in Word helps you create, edit, summarize, and transform written content. "
        "It can generate entire documents from scratch, rewrite sections, adjust tone, "
        "and pull information from other files.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Draft Documents from Scratch", [
        bullet_line('"Draft a project proposal for migrating our file storage to SharePoint, including timeline and budget estimates."'),
        bullet_line('"Write a 2-page executive summary of our Q1 2026 financial performance based on /Q1 Report.xlsx."'),
        bullet_line('"Create a client engagement letter for a new audit client, including scope of services and fees."'),
    ]))
    e.append(subsection("Summarize Long Documents", [
        bullet_line('"Summarize this document into 5 key bullet points."'),
        bullet_line('"Create a one-paragraph executive summary of this 30-page report."'),
    ]))
    e.append(subsection("Rewrite &amp; Adjust Tone", [
        bullet_line('"Rewrite this paragraph to sound more professional and concise."'),
        bullet_line('"Simplify this technical explanation so a non-technical audience can understand it."'),
    ]))
    e.append(subsection("Generate From Other Files", [
        bullet_line('"Write a summary report based on /Meeting Notes - May 2026.docx."'),
        bullet_line('"Create a comparison table using data from /Vendor A Proposal.pdf and /Vendor B Proposal.pdf."'),
    ]))
    e.append(subsection("Insert Tables, Outlines &amp; Structure", [
        bullet_line('"Add a table comparing the pros and cons of cloud migration vs. on-premise storage."'),
        bullet_line('"Create an outline for a cybersecurity policy document with at least 8 sections."'),
    ]))
    return e


def build_sec3():
    e = []
    e += section_header(3, "Copilot in Excel", "sec3")
    e.append(Paragraph(
        "Copilot in Excel transforms how you work with data. It can analyze datasets, create formulas, "
        "generate charts, identify trends, and provide insights — all through natural language. "
        "Your data must be formatted as a Table.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Analyze Data &amp; Provide Insights", [
        bullet_line('"What are the key trends in this sales data over the past 12 months?"'),
        bullet_line('"Which product category has the highest profit margin?"'),
        bullet_line('"Analyze this dataset and highlight any anomalies or outliers."'),
    ]))
    e.append(subsection("Create Formulas", [
        bullet_line('"Add a column that calculates the year-over-year growth rate for each row."'),
        bullet_line('"Write a VLOOKUP to match employee IDs from Sheet2 to this table."'),
    ]))
    e.append(subsection("Generate Charts &amp; Visualizations", [
        bullet_line('"Create a bar chart showing monthly revenue by region."'),
        bullet_line('"Make a line chart comparing this year’s sales vs. last year’s."'),
    ]))
    e.append(subsection("Sort, Filter, Conditional Formatting", [
        bullet_line('"Sort this table by revenue in descending order."'),
        bullet_line('"Highlight all rows where the status is ‘Overdue’."'),
        bullet_line('"Color-code this column: red for overdue, yellow for pending, green for complete."'),
    ]))
    e.append(subsection("Identify Patterns &amp; Forecasting", [
        bullet_line('"Is there a correlation between marketing spend and sales revenue?"'),
        bullet_line('"What would Q3 revenue look like if current trends continue?"'),
    ]))
    return e


def build_sec4():
    e = []
    e += section_header(4, "Copilot in Outlook", "sec4")
    e.append(Paragraph(
        "Copilot in Outlook helps you manage your inbox more efficiently by drafting emails, "
        "summarizing long threads, suggesting replies, coaching your tone, and prioritizing "
        "what matters most.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Draft Emails", [
        bullet_line('"Draft an email to the client thanking them for the meeting and summarizing next steps."'),
        bullet_line('"Compose a message to the team announcing the new project kickoff date."'),
    ]))
    e.append(subsection("Summarize Email Threads", [
        bullet_line('"Summarize this email thread — what was decided and what’s still open?"'),
        bullet_line('"What action items were assigned in this thread?"'),
    ]))
    e.append(subsection("Suggest &amp; Improve Replies", [
        bullet_line('"Suggest a polite reply declining this meeting invitation."'),
        bullet_line('"Draft a reply confirming the deliverables and timeline discussed."'),
    ]))
    e.append(subsection("Coaching &amp; Tone Adjustment", [
        bullet_line('"Does this email sound too aggressive? Suggest improvements."'),
        bullet_line('"Make this more concise — I want to keep it under 3 sentences."'),
    ]))
    e.append(subsection("Prioritize &amp; Schedule", [
        bullet_line('"What are the most important emails I received this morning?"'),
        bullet_line('"Draft an email proposing 3 possible meeting times next week."'),
    ]))
    return e


def build_sec5():
    e = []
    e += section_header(5, "Copilot in Teams", "sec5")
    e.append(Paragraph(
        "Copilot in Teams elevates meetings and chat by providing real-time summaries, extracting "
        "action items, catching you up on conversations, and helping you draft responses — "
        "all without leaving Teams.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Meeting Summaries", [
        bullet_line('"Summarize this meeting — what were the key decisions?"'),
        bullet_line('"Generate a meeting recap I can share with stakeholders who weren’t present."'),
    ]))
    e.append(subsection("Extract Action Items", [
        bullet_line('"What action items were assigned during this meeting?"'),
        bullet_line('"Who agreed to do what, and by when?"'),
    ]))
    e.append(subsection("Chat Summarization", [
        bullet_line('"Summarize the last 24 hours of this chat."'),
        bullet_line('"What’s the latest update on the IT migration project in this channel?"'),
    ]))
    e.append(subsection("Catch Up on Missed Meetings", [
        bullet_line('"What did I miss in this morning’s team standup?"'),
        bullet_line('"Summarize the client call from yesterday and list follow-ups."'),
    ]))
    e.append(subsection("Draft Messages &amp; Real-Time Recap", [
        bullet_line('"Draft a message updating the team on the project status."'),
        bullet_line('"What has been discussed so far?"'),
    ]))
    return e


def build_sec6():
    e = []
    e += section_header(6, "Copilot in PowerPoint", "sec6")
    e.append(Paragraph(
        "Copilot in PowerPoint helps you create beautiful, on-brand presentations from prompts, "
        "existing documents, or templates — and refine them with speaker notes, visual "
        "suggestions, and content restructuring.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Generate Presentations", [
        bullet_line('"Create a presentation about our Q1 performance using /Q1 Report.docx."'),
        bullet_line('"Build a 10-slide deck introducing Microsoft 365 Copilot to new employees."'),
    ]))
    e.append(subsection("Summarize &amp; Redesign", [
        bullet_line('"Summarize this presentation in 5 key points."'),
        bullet_line('"Redesign this slide to be more visually engaging."'),
    ]))
    e.append(subsection("Add Visuals &amp; Speaker Notes", [
        bullet_line('"Add a relevant image to this slide about cloud security."'),
        bullet_line('"Add speaker notes to every slide in this presentation."'),
    ]))
    e.append(subsection("Organize &amp; Restructure", [
        bullet_line('"Reorder these slides to tell a more compelling story."'),
        bullet_line('"Split this dense slide into 3 separate slides for clarity."'),
    ]))
    return e


def build_sec7():
    e = []
    e += section_header(7, "Copilot Chat (Business Chat)", "sec7")
    e.append(Paragraph(
        "Copilot Chat — at microsoft365.com/chat or in the Teams sidebar — searches "
        "across your entire Microsoft 365 ecosystem (emails, files, chats, meetings, contacts) "
        "to answer questions and generate content.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Cross-App Search &amp; Retrieval", [
        bullet_line('"What’s the latest update on the server migration project?"'),
        bullet_line('"Find the budget spreadsheet that Ashley shared last week."'),
    ]))
    e.append(subsection("Summarize Files &amp; Answer Questions", [
        bullet_line('"Summarize /2026 Strategic Plan.docx."'),
        bullet_line('"What is our PTO policy?"'),
    ]))
    e.append(subsection("Compare Documents &amp; Prepare for Meetings", [
        bullet_line('"Compare /Proposal v1.docx and /Proposal v2.docx — what changed?"'),
        bullet_line('"Prepare me for my meeting with Robert Christian tomorrow."'),
    ]))
    return e


def build_sec8():
    e = []
    e += section_header(8, "Copilot in OneDrive / SharePoint", "sec8")
    e.append(Paragraph(
        "Copilot integrates with OneDrive and SharePoint to help you find, summarize, and compare "
        "files — turning your file storage into a searchable knowledge base.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Summarize &amp; Search", [
        bullet_line('"Summarize this PDF report."'),
        bullet_line('"Find all documents related to the 2026 audit."'),
    ]))
    e.append(subsection("Compare Versions &amp; Ask Questions", [
        bullet_line('"What changed between v1 and v2 of this proposal?"'),
        bullet_line('"What does the IT security policy say about remote access?"'),
    ]))
    return e


def build_sec9():
    e = []
    e += section_header(9, "Prompt Engineering Best Practices", "sec9")
    e.append(Paragraph(
        "The quality of Copilot’s output depends directly on the quality of your prompt. "
        "A well-structured prompt includes what you want, the context, the desired format, "
        "and any constraints.", BODY_J))
    e.append(sp(6))
    e.append(subsection("The Prompt Framework: Task + Context + Format + Constraints", [
        bold_bullet("Task:", "What do you want Copilot to do? (Summarize, Draft, Analyze, Compare, Create)"),
        bold_bullet("Context:", "Background info, files, audience, or purpose."),
        bold_bullet("Format:", "How should the output look? (Bullet points, table, email, paragraph, numbered list)"),
        bold_bullet("Constraints:", "Length limits, tone, things to include or exclude."),
    ]))

    # Good vs. Bad Prompts table
    gvb_hdr_style = S('gvb_hdr', fontName='Helvetica-Bold', fontSize=9,
                      leading=12, textColor=white, alignment=TA_CENTER)
    gvb_weak  = S('gvb_weak',  fontName='Helvetica', fontSize=8.5, leading=12, textColor=BODY_CLR)
    gvb_strong= S('gvb_strong',fontName='Helvetica', fontSize=8.5, leading=12, textColor=BODY_CLR)

    rows = [
        [Paragraph('■ Weak Prompt', gvb_hdr_style),
         Paragraph('■ Strong Prompt', gvb_hdr_style)],
        [Paragraph('Write about cybersecurity.', gvb_weak),
         Paragraph('Draft a 1-page summary of our cybersecurity policies for new employees, using bullet points, in a professional tone.', gvb_strong)],
        [Paragraph('Summarize this.', gvb_weak),
         Paragraph('Summarize this 20-page report into 5 key takeaways, formatted as a numbered list for an executive audience.', gvb_strong)],
        [Paragraph('Make a chart.', gvb_weak),
         Paragraph('Create a bar chart comparing monthly revenue by region for Q1 2026 using the data in this table.', gvb_strong)],
        [Paragraph('Fix this email.', gvb_weak),
         Paragraph('Rewrite this email to be more concise and professional. Keep it under 4 sentences and remove the jargon.', gvb_strong)],
        [Paragraph('Tell me about the project.', gvb_weak),
         Paragraph('Based on recent Teams chats and emails, summarize the current status of the server migration project, including open issues and next steps.', gvb_strong)],
        [Paragraph('Analyze the data.', gvb_weak),
         Paragraph('Analyze the sales data in this table: identify the top 3 products by revenue, flag any declining trends, and suggest areas for improvement.', gvb_strong)],
    ]
    col1 = (CW - 1) * 0.30
    col2 = (CW - 1) * 0.70
    gvb_table = Table(rows, colWidths=[col1, col2], hAlign='LEFT')
    gvb_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), TABLE_HDR),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [white, ALT_ROW]),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
        ('GRID',          (0, 0), (-1, -1), 0.5, GRAY_LINE),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    e.append(KeepTogether([sp(4), SubsectionHeader("Good vs. Bad Prompts"), sp(4), gvb_table]))

    e.append(subsection("Power User Tips", [
        std_bullet('Use file references with <b>/</b> to point Copilot at specific documents: <i>"Summarize /ProjectPlan.docx"</i>'),
        std_bullet('Always specify the audience: <i>"...for a non-technical audience"</i> or <i>"...for the CFO"</i>'),
        std_bullet('Iterate — refine your prompt if the first result isn’t perfect: <i>"Make it shorter"</i> or <i>"Add more detail about..."</i>'),
        std_bullet('Use role-based framing: <i>"Act as a project manager and draft a status update..."</i>'),
        std_bullet('Chain prompts — start broad, then narrow: Summarize → Extract action items → Draft an email with those items'),
        std_bullet('Ask Copilot to cite sources: <i>"...and indicate which file each point came from."</i>'),
    ]))
    return e


def build_sec10():
    e = []
    e += section_header(10, "Advanced Use Cases & Workflows", "sec10")
    e.append(Paragraph(
        "These advanced scenarios combine multiple Copilot capabilities across apps for "
        "powerful end-to-end workflows.", BODY_J))
    e.append(sp(6))
    e.append(subsection("Knowledge Base System",
        [bullet_line('"Store structured docs in OneDrive → Copilot retrieves them on demand."'),
         bullet_line('"Ask Copilot Chat: What is the onboarding process, based on our knowledge base?"')],
        intro="Store structured documents in OneDrive/SharePoint and use Copilot Chat to retrieve answers on demand."))
    e.append(subsection("Automated Client File Processing",
        [bullet_line('"Power Automate: When email arrives from client → save attachments to client folder."'),
         bullet_line('"Copilot Chat: What are the outstanding items for Client XYZ based on recent emails?"')],
        intro="Use Power Automate to capture incoming emails, extract key data, and store organized files in SharePoint."))
    e.append(subsection("Meeting-to-Action Pipeline",
        [bullet_line('"Teams Copilot: Extract action items from this meeting."'),
         bullet_line('"Outlook Copilot: Draft follow-up emails to each person with their assigned tasks."')],
        intro="Automatically capture meeting notes, extract action items, and assign tasks via Planner or To-Do."))
    e.append(subsection("Agent-Driven Pipelines (Copilot Studio)",
        [bullet_line('"Build an agent that takes client questions and routes them to the right department."'),
         bullet_line('"Create an agent that ingests conversations, converts them to JSON, and stores them."')],
        intro="Build custom agents that automate entire workflows — from data intake to processing to output delivery."))
    e.append(subsection("Compliance &amp; Audit Support",
        [bullet_line('"Copilot Chat: Summarize all financial documents from Q1 for the auditor."'),
         bullet_line('"Excel Copilot: Flag any transactions in this ledger that exceed the $5,000 threshold."')],
        intro="Use Copilot to help with audit preparation, compliance tracking, and document review."))
    return e


def eng_legend_row(color_hex, label, desc, tag):
    sq  = S('sq',  fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=HexColor(color_hex))
    lbl = S('lbl', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=HexColor(color_hex))
    dsc = S('dsc', fontName='Helvetica',      fontSize=8.5, leading=12, textColor=BODY_CLR)
    tg  = S('tg',  fontName='Helvetica-Bold', fontSize=8,  leading=12, textColor=BODY_CLR, alignment=TA_CENTER)
    return [
        Paragraph(f'<font color="{color_hex}">■</font> <b>{label}</b>', lbl),
        Paragraph(desc, dsc),
        Paragraph(tag, tg),
    ]


def build_sec11():
    e = []
    e += section_header(11, "Quick Reference Table — with Engine Guide", "sec11")
    e.append(Paragraph(
        "A one-glance summary of Copilot capabilities across all apps, now including which AI engine "
        "is recommended for each task type. The model picker (Auto / Quick / Think Deeper) is "
        "available in most apps.", BODY_J))
    e.append(sp(8))

    # Engine Legend
    eng_rows = [
        [Paragraph('<b>Engine Legend</b>', S('el', fontName='Helvetica-Bold', fontSize=9,
                   leading=12, textColor=white, alignment=TA_CENTER))],
    ]
    legend_hdr = Table([[Paragraph('<b>Engine Legend</b>', S('el', fontName='Helvetica-Bold',
                          fontSize=9.5, leading=13, textColor=white, alignment=TA_CENTER))]],
                       colWidths=[CW])
    legend_hdr.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), TABLE_HDR),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    e.append(legend_hdr)

    leg_data = [
        eng_legend_row('#1F4E79', 'Quick Response',
            'GPT-5.3 or equivalent fast model. Best for: drafting, simple Q&A, formatting, email replies, basic summarization.',
            'Speed-first tasks'),
        eng_legend_row('#1F4E79', 'Think Deeper',
            'GPT-5.4 or Claude Opus. Best for: complex analysis, multi-document reasoning, financial modeling, research.',
            'Accuracy-first tasks'),
        eng_legend_row('#375623', 'Claude (Anthropic)',
            'Claude Sonnet 4 / Opus 4.6 (selectable in Word, Researcher, Copilot Studio). Best for: long-form writing, nuanced editing, agentic tasks via Cowork.',
            'Writing & agents'),
        eng_legend_row('#7F6000', 'Auto (Default)',
            'Copilot automatically routes your request to the best model based on complexity. Recommended for most everyday tasks.',
            'General use'),
    ]
    legend_bg = [white, ALT_ROW, HexColor('#F0F8ED'), HexColor('#FFFDE7')]
    leg_table = Table(leg_data, colWidths=[1.4*inch, CW - 2.7*inch, 1.3*inch])
    leg_table.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), legend_bg),
        ('TOPPADDING',     (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',  (0,0), (-1,-1), 5),
        ('LEFTPADDING',    (0,0), (-1,-1), 6),
        ('RIGHTPADDING',   (0,0), (-1,-1), 6),
        ('GRID',           (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('VALIGN',         (0,0), (-1,-1), 'TOP'),
    ]))
    e.append(leg_table)
    e.append(sp(10))

    # Main reference table
    qr_hdr_s  = S('qrh', fontName='Helvetica-Bold', fontSize=9,   leading=12, textColor=white, alignment=TA_CENTER)
    qr_app_s  = S('qra', fontName='Helvetica-Bold', fontSize=9,   leading=12, textColor=TOC_BLUE)
    qr_fn_s   = S('qrf', fontName='Helvetica',      fontSize=8.5, leading=12, textColor=BODY_CLR)
    qr_ex_s   = S('qre', fontName='Helvetica-Oblique', fontSize=8.5, leading=12, textColor=BODY_CLR)
    qr_eng_s  = S('qrg', fontName='Helvetica',      fontSize=8.5, leading=12, textColor=BODY_CLR)

    def qr_row(app, funcs, example, engine, bg=white):
        return [Paragraph(app, qr_app_s), Paragraph(funcs, qr_fn_s),
                Paragraph(f'<i>{example}</i>', qr_ex_s), Paragraph(engine, qr_eng_s)]

    qr_data = [
        [Paragraph('App', qr_hdr_s), Paragraph('Top Functions', qr_hdr_s),
         Paragraph('Best Example Prompt', qr_hdr_s), Paragraph('Recommended Engine', qr_hdr_s)],
        qr_row('Word', 'Draft, Summarize, Rewrite, Generate from files',
               '"Draft a project proposal based on /ProjectBrief.docx"',
               '■ Quick for drafts\n■ Claude for long-form / nuanced editing\n■ Think Deeper for exec reports'),
        qr_row('Excel', 'Analyze, Create formulas, Charts, Trends',
               '"Analyze this data and show the top 3 products by revenue"',
               '■ Think Deeper for complex analysis\n■ Quick for simple formulas\n■ Auto for charts'),
        qr_row('Outlook', 'Draft emails, Summarize threads, Tone coaching',
               '"Summarize this thread and list action items"',
               '■ Quick Response for drafts & summaries\n■ Think Deeper for sensitive or strategic messages'),
        qr_row('Teams', 'Meeting recaps, Action items, Chat summaries',
               '"What action items were assigned to me in this meeting?"',
               '■ Auto (Copilot routes automatically)\n■ Think Deeper for large meeting recaps'),
        qr_row('PowerPoint', 'Generate decks, Redesign, Speaker notes',
               '"Create a presentation from /Q1 Report.docx"',
               '■ Auto for deck generation\n■ Claude for narrative/story-driven content\n■ Quick for speaker notes'),
        qr_row('OneNote', 'Summarize notes, To-do lists, Rewrite sections',
               '"Create a to-do list from my meeting notes"',
               '■ Quick Response for most tasks'),
        qr_row('Copilot Chat', 'Cross-app search, File summaries, Q&A',
               '"Prepare me for my 2 PM meeting with the client"',
               '■ Think Deeper (Researcher mode) for deep research\n■ Claude available in Researcher\n■ Quick for factual lookups'),
        qr_row('Power Automate', 'Build flows, Edit automations, Troubleshoot',
               '"Create a flow that saves email attachments to OneDrive"',
               '■ Auto — Copilot selects best model for flow generation'),
        qr_row('Copilot Studio', 'Build agents, Create topics, Connect data',
               '"Build an agent that answers HR policy questions"',
               '■ Claude Sonnet 4 / Opus 4.6 recommended for agent reasoning\nManually selectable in Studio settings'),
        qr_row('Power Apps', 'Generate apps, Modify layouts, Add features',
               '"Create an app to track time-off requests"',
               '■ Auto — GPT-5.x family for app generation'),
        qr_row('OneDrive', 'Summarize files, Search, Compare versions',
               '"What are the key findings in this PDF report?"',
               '■ Quick for single-file summaries\n■ Think Deeper for multi-file comparisons'),
        qr_row('SharePoint', 'Knowledge retrieval, Document search, Q&A',
               '"Find all documents related to the 2026 audit"',
               '■ Quick for search/retrieval\n■ Think Deeper for cross-document synthesis'),
        qr_row('Loop', 'Brainstorm, Collaborate, Summarize workspaces',
               '"Brainstorm 10 ways to improve client communication"',
               '■ Quick Response — brainstorming is speed-oriented'),
        qr_row('Copilot Cowork', 'Multi-step autonomous tasks, cross-app workflows',
               '"Research our top 5 clients and draft a status email for each"',
               '■ Claude (Anthropic agentic model) — Cowork is built on Claude’s agentic harness'),
    ]
    cw1 = 0.80*inch; cw2 = 1.45*inch; cw3 = 1.95*inch; cw4 = CW - cw1 - cw2 - cw3
    qr_table = Table(qr_data, colWidths=[cw1, cw2, cw3, cw4], repeatRows=1)
    qr_bg = [ALT_ROW, white] * 8
    qr_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TABLE_HDR),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [white, ALT_ROW]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 5),
        ('RIGHTPADDING',  (0,0), (-1,-1), 5),
        ('GRID',          (0,0), (-1,-1), 0.4, GRAY_LINE),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    e.append(qr_table)
    e.append(sp(8))
    e.append(NoteBox(
        "■ Tip: The model picker appears in the Copilot pane toolbar. Use ‘Auto’ for everyday tasks. "
        "Switch to ‘Think Deeper’ when you need multi-document reasoning or financial analysis. "
        "Claude models (selectable in Word and Copilot Studio as of April 2026) excel at nuanced writing "
        "and agentic workflows."
    ))
    return e


def build_sec12():
    e = []
    e += section_header(12, "NEW — Microsoft 365 Copilot vs. Copilot Cowork", "sec12")
    e.append(Paragraph(
        "Microsoft offers two distinct AI work tools under the Copilot umbrella. Understanding the "
        "difference helps you use the right one — or know when both belong in your workflow.",
        BODY_J))
    e.append(sp(6))

    # What is M365 Copilot
    e.append(KeepTogether([
        sp(4), SubsectionHeader("What Is Microsoft 365 Copilot?"), sp(2),
        Paragraph(
            "<b>Microsoft 365 Copilot</b> is the AI assistant embedded inside individual M365 apps — "
            "Word, Excel, Outlook, Teams, PowerPoint, and more. You prompt it within a single app and it "
            "responds in one turn. It’s best described as a smart, context-aware helper: it drafts "
            "your emails, summarizes your documents, generates formulas, and recaps your meetings. Most "
            "users interact with Copilot this way today.", BODY_J),
    ]))

    # What is Copilot Cowork
    e.append(KeepTogether([
        sp(4), SubsectionHeader("What Is Copilot Cowork?"), sp(2),
        Paragraph(
            "<b>Copilot Cowork</b> is a fundamentally different product — an autonomous AI agent "
            "launched March 9, 2026 and built on Anthropic’s Claude agentic technology. Rather than "
            "responding to a single prompt in one app, Cowork accepts a goal, breaks it into steps, "
            "executes those steps autonomously across multiple M365 apps (Outlook, Teams, Excel, "
            "SharePoint, Calendar), checks in at key decision points, and delivers complete multi-app "
            "deliverables. It is part of Microsoft 365 E7 ($99/user/month, GA May 2026).", BODY_J),
    ]))

    e.append(sp(6))
    e.append(SubsectionHeader("Side-by-Side Comparison"))
    e.append(sp(4))

    c_hdr = S('ch', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=white, alignment=TA_CENTER)
    c_lbl = S('cl', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=TOC_BLUE)
    c_cel = S('cc', fontName='Helvetica',      fontSize=8.5, leading=12, textColor=BODY_CLR)

    def crow(label, left, right, bg=white):
        return [Paragraph(label, c_lbl), Paragraph(left, c_cel), Paragraph(right, c_cel)]

    comp_data = [
        [Paragraph('', c_hdr),
         Paragraph('Microsoft 365 Copilot', c_hdr),
         Paragraph('Copilot Cowork', c_hdr)],
        crow('What it is',
             'AI assistant embedded in individual M365 apps. Responds to one prompt at a time within a single app.',
             'Autonomous AI agent. Accepts a goal and executes multi-step workflows across multiple M365 apps.'),
        crow('How you interact',
             'Type a prompt inside Word, Excel, Outlook, Teams, etc. Copilot responds immediately in that app.',
             'Describe a desired outcome. Cowork plans the work, runs it across apps, and checks in as it progresses.'),
        crow('Scope',
             'Single app per interaction. Copilot in Word stays in Word; Copilot in Teams stays in Teams.',
             'Cross-app. One request can span Outlook + Teams + Excel + SharePoint + Calendar in a single run.'),
        crow('Duration',
             'Seconds. Single-turn responses to your prompt.',
             'Minutes to hours. Long-running tasks that execute across your entire M365 environment.'),
        crow('User involvement',
             'High. You direct every step with individual prompts.',
             'Low. You set the goal; Cowork executes. It checks in at key decision points but runs autonomously.'),
        crow('Data access',
             'Microsoft Graph — your emails, files, chats, calendar, within the app you’re using.',
             'Full Microsoft Graph via ‘Work IQ’ layer — draws on signals from emails, calendar, Teams chats, SharePoint, relationships, and org structure.'),
        crow('AI model',
             'GPT-5 family (Auto/Quick/Think Deeper). Claude available in Word and Researcher (opt-in).',
             'Built on Claude’s agentic harness (Anthropic). Multi-model: Claude for autonomous execution + GPT-5.4 for some task layers.'),
        crow('Output',
             'Text, tables, charts, drafts — delivered inside the current app.',
             'Complete deliverables stored directly in OneDrive/SharePoint: finished Word docs, Excel models, drafted emails, updated calendars.'),
        crow('Best for',
             'Daily in-app productivity: drafting, summarizing, analyzing, formatting — one task at a time.',
             'Complex delegated work: ‘Research our top clients and prep briefing decks for each’ — tasks that would take a human hours.'),
        crow('Best prompt example',
             '"Summarize this email thread and list action items."',
             '"Review all open client files in SharePoint, flag any missing deliverables, and draft a status update email for each."'),
    ]
    cl0 = 1.1*inch; cl1 = (CW - cl0) / 2; cl2 = CW - cl0 - cl1
    comp_table = Table(comp_data, colWidths=[cl0, cl1, cl2])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TABLE_HDR),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [white, ALT_ROW]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        ('GRID',          (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    e.append(comp_table)
    e.append(sp(8))

    # When to use which
    e.append(KeepTogether([
        SubsectionHeader("When to Use Which"),
        sp(4),
    ]))

    wh_hdr_s = S('wh_h', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=TOC_BLUE)
    wh_itm_s = S('wh_i', fontName='Helvetica',      fontSize=9,   leading=13, textColor=BODY_CLR)

    def wh_bullet(text):
        return Paragraph(f'•  {text}', wh_itm_s)

    left_items = [
        Paragraph('Use M365 Copilot when...', wh_hdr_s), sp(3),
        wh_bullet('You need to draft, summarize, or analyze within one app'),
        wh_bullet('Tasks are self-contained and take seconds to minutes'),
        wh_bullet('You want to stay in the driver’s seat at every step'),
        wh_bullet('You’re on a standard M365 Copilot license'),
        wh_bullet('You need a quick answer from your emails, files, or calendar'),
    ]
    right_items = [
        Paragraph('Use Copilot Cowork when...', wh_hdr_s), sp(3),
        wh_bullet('You want to delegate a complex, multi-step outcome'),
        wh_bullet('The task spans multiple apps (e.g., Outlook + SharePoint + Excel)'),
        wh_bullet('You need Cowork to run in the background and check in when ready'),
        wh_bullet('You’re on M365 E7 or have early Frontier access'),
        wh_bullet('You want AI to act like a junior analyst — plan the work, do the work, report back'),
    ]

    from reportlab.platypus import ListFlowable
    wh_table = Table(
        [[left_items, right_items]],
        colWidths=[(CW-4)/2, (CW-4)/2]
    )
    wh_table.setStyle(TableStyle([
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('GRID',          (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('BACKGROUND',    (0,0), (0,0),  HexColor('#F5FAFF')),
        ('BACKGROUND',    (1,0), (1,0),  HexColor('#F5FAFF')),
    ]))
    e.append(wh_table)
    e.append(sp(8))
    e.append(NoteBox(
        "■ Think of it this way: M365 Copilot is your in-app AI assistant — you ask, it answers, "
        "you act. Copilot Cowork is your AI delegate — you set the goal, it plans and executes, then "
        "reports back. Most organizations will use Copilot daily for personal productivity and deploy Cowork "
        "for high-value, repetitive multi-step processes like client reporting, audit prep, or onboarding workflows."
    ))
    return e


def build_step(num, title, body):
    """Numbered step row with dark navy number box."""
    num_s  = S('ns',  fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=white, alignment=TA_CENTER)
    ttl_s  = S('ts',  fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=BODY_CLR)
    bdy_s  = S('bs',  fontName='Helvetica',      fontSize=9,  leading=13, textColor=BODY_CLR)
    t = Table(
        [[Paragraph(str(num), num_s), [Paragraph(title, ttl_s), Paragraph(body, bdy_s)]]],
        colWidths=[0.38*inch, CW - 0.38*inch - 2]
    )
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (0,0), DARK_NAVY),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (0,0), 4),
        ('RIGHTPADDING',  (0,0), (0,0), 4),
        ('LEFTPADDING',   (1,0), (1,0), 8),
        ('RIGHTPADDING',  (1,0), (1,0), 6),
        ('LINEBELOW',     (0,0), (-1,0), 0.5, GRAY_LINE),
    ]))
    return t


def build_sec13():
    e = []
    e += section_header(13, "NEW — How to Record Meetings in Teams with Copilot", "sec13")
    e.append(Paragraph(
        "Microsoft Teams + Copilot gives you a complete meeting capture workflow: record or transcribe "
        "meetings, get AI-generated summaries, and extract action items — all without leaving Teams.",
        BODY_J))
    e.append(sp(6))

    e.append(subsection("Prerequisites", [
        bold_bullet("Active Microsoft 365 subscription", "with a Copilot license"),
        bold_bullet("Appropriate admin permissions", "in your Teams tenant (recording must be enabled)"),
        bold_bullet("Latest version of", "Teams desktop or web app"),
        bold_bullet("Transcription enabled", "in tenant settings — Copilot requires transcription to generate summaries"),
        std_bullet("Meeting organizer must have Copilot set to <b>‘During and after the meeting’</b> (the default) in meeting options"),
    ]))

    steps_intro = KeepTogether([sp(4), SubsectionHeader("Step-by-Step: Start Recording + Transcription During a Meeting"), sp(4)])
    e.append(steps_intro)

    steps = [
        (1, "Join or Start the Meeting",
         "Open Microsoft Teams and join or start your meeting as usual."),
        (2, "Enable Copilot / Transcription",
         "From the meeting toolbar, click the Copilot button (■). Teams will prompt you to enable transcription — turn it on. Transcription is required for Copilot to understand and summarize the meeting."),
        (3, "Start Recording (Optional)",
         "Click More actions (•••) → Record and transcribe → Start recording. Recording captures audio/video for full playback later. Transcription alone is sufficient for Copilot summaries if you don’t need video."),
        (4, "Notification to Participants",
         "All participants will see a notification that the meeting is being recorded/transcribed. Participants can choose to hide their identities in captions and transcripts."),
        (5, "Use Copilot In Real-Time",
         'While the meeting is live, open the Copilot panel and ask: "What has been discussed so far?" or "Have we covered the budget?" or "List key decisions made."'),
        (6, "Stop Recording / Transcription",
         "Click More actions → Record and transcribe → Stop recording. Transcription stops automatically at meeting end."),
        (7, "Access the Recap After the Meeting",
         "Go to the meeting in your Teams calendar or chat → click Recap tab. You’ll find the AI-generated summary, action items, and full transcript. The transcript is stored in the meeting organizer’s OneDrive for Business."),
    ]
    for num, title, body in steps:
        e.append(build_step(num, title, body))
        e.append(sp(2))

    e.append(sp(6))
    e.append(KeepTogether([
        SubsectionHeader("Set Up Auto-Recording / Auto-Transcription Before a Meeting"), sp(2),
        Paragraph("Configure recording and transcription to start automatically when your meeting begins:", BODY),
        sp(2),
        bold_bullet("Open your Teams calendar", "and edit the meeting invite."),
        bold_bullet("Click Meeting options", "(in the toolbar or at the bottom of the invite)."),
        bold_bullet("Scroll to the", "<b>Recording &amp; Transcription</b> section."),
        std_bullet("Under the automatic options dropdown, choose one of the settings below:"),
    ]))
    e.append(sp(4))

    # Settings table
    st_hdr_s = S('sth', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=white, alignment=TA_CENTER)
    st_lbl_s = S('stl', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=TOC_BLUE)
    st_cel_s = S('stc', fontName='Helvetica',      fontSize=8.5, leading=12, textColor=BODY_CLR)
    st_new_s = S('stn', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=HexColor('#375623'))

    settings_data = [
        [Paragraph('Setting', st_hdr_s), Paragraph('What It Does', st_hdr_s)],
        [Paragraph('Off (Default)', st_lbl_s),
         Paragraph('No automatic recording or transcription. Must be started manually.', st_cel_s)],
        [Paragraph('Record and transcribe', st_lbl_s),
         Paragraph('Both recording (video/audio) and transcription start automatically when the meeting begins.', st_cel_s)],
        [Paragraph('Transcribe only ■ (New — May 2026)', st_new_s),
         Paragraph('Only transcription starts automatically — no video recording is created. Supports Copilot and Intelligent Recap. Best for privacy-sensitive meetings.', st_cel_s)],
    ]
    st_table = Table(settings_data, colWidths=[1.8*inch, CW - 1.8*inch])
    st_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TABLE_HDR),
        ('BACKGROUND',    (0,3), (-1,3), HexColor('#F0F8ED')),
        ('ROWBACKGROUNDS',(0,1), (-1,2), [white, ALT_ROW]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        ('GRID',          (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    e.append(st_table)
    e.append(sp(6))
    e.append(bold_bullet("For A3 license holders:", "toggle ‘Record and transcribe automatically’ under Meeting Options."))
    e.append(bold_bullet("For Teams Premium users:", "save these settings as a personal meeting template for all future meetings."))
    e.append(bold_bullet("Important:", "Copilot setting must be ‘During and after meeting’ — recording is disabled if Copilot is set to Off."))

    e.append(sp(8))

    # What Copilot Can Do After
    e.append(KeepTogether([
        SubsectionHeader("What Copilot Can Do After the Meeting"), sp(2),
        Paragraph("Once transcription is complete, the Recap tab in Teams gives you AI-powered access to the full meeting:", BODY),
        sp(4),
    ]))

    rc_lbl_s = S('rcl', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=white)
    rc_cel_s = S('rcc', fontName='Helvetica',      fontSize=8.5, leading=12, textColor=BODY_CLR)
    recap_data = [
        [Paragraph('■ Summary',       rc_lbl_s), Paragraph('AI-generated overview of key topics, decisions, and outcomes.', rc_cel_s)],
        [Paragraph('■ Action Items',  rc_lbl_s), Paragraph('Automatically identified tasks with the assigned person and deadline.', rc_cel_s)],
        [Paragraph('■ Full Transcript',rc_lbl_s),Paragraph('Searchable, time-stamped transcript with speaker identification. Stored in organizer’s OneDrive.', rc_cel_s)],
        [Paragraph('■ Ask Copilot',   rc_lbl_s), Paragraph('Open the Copilot chat in Recap and ask any question about the meeting: who said what, what was decided, what to do next.', rc_cel_s)],
        [Paragraph('■ Draft Follow-Up',rc_lbl_s),Paragraph('Ask Copilot to draft a follow-up email with action items for each attendee.', rc_cel_s)],
        [Paragraph('■ Translate',     rc_lbl_s), Paragraph('Transcripts can be translated to other languages via language settings.', rc_cel_s)],
    ]
    rc_table = Table(recap_data, colWidths=[1.4*inch, CW - 1.4*inch])
    rc_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (0,-1), DARK_NAVY),
        ('ROWBACKGROUNDS',(1,0), (1,-1), [white, ALT_ROW]),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        ('GRID',          (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    e.append(rc_table)
    e.append(sp(8))

    # Sample prompts
    e.append(KeepTogether([
        SubsectionHeader("Sample Copilot Prompts — In &amp; After Meetings"), sp(4),
        Paragraph('<b><font color="#2563A8">During the meeting:</font></b>',
                  S('dp', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=TOC_BLUE)),
        sp(2),
        bullet_line('"What has been discussed so far?"'),
        bullet_line('"Have we talked about the budget yet?"'),
        bullet_line('"Summarize the points of disagreement so far."'),
        bullet_line('"List any decisions that have been made."'),
        sp(4),
        Paragraph('<b><font color="#2563A8">In the Recap tab after:</font></b>',
                  S('dp2', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=TOC_BLUE)),
        sp(2),
        bullet_line('"What were the key decisions from this meeting?"'),
        bullet_line('"List all action items and who they were assigned to."'),
        bullet_line('"Draft a follow-up email with a summary and next steps."'),
        bullet_line('"What did I miss — I joined 15 minutes late."'),
        bullet_line('"Were there any unresolved questions?"'),
    ]))
    e.append(sp(8))
    e.append(NoteBox(
        "■■ Admin note: Recording and transcription must be enabled at the tenant level by your IT admin. "
        "If the recording button is greyed out, check that the Copilot meeting option is not set to ‘Off’ "
        "— they are now linked and cannot be separated. For compliance environments, ‘Transcribe only’ "
        "(rolling out May–June 2026) is the recommended setting."
    ))
    return e


# ── Assemble & build ──────────────────────────────────────────────────────────

def main():
    out = "/home/user/reconciltool/M365_Copilot_Cheat_Sheet_v5.pdf"
    doc = CheatSheetDoc(out)

    story = []
    story += build_toc()
    story.append(PageBreak())

    for builder in [
        build_sec1, build_sec2, build_sec3, build_sec4,
        build_sec5, build_sec6, build_sec7, build_sec8,
        build_sec9, build_sec10, build_sec11, build_sec12, build_sec13,
    ]:
        story += builder()
        story.append(sp(8))

    doc.build(story)
    print(f"PDF written to {out}")


if __name__ == '__main__':
    main()
