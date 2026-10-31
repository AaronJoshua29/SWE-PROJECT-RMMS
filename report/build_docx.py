#!/usr/bin/env python3
"""
Build the Word (.docx) version of the RMMS project report from REPORT.md.

It converts the Markdown (headings, tables, images, code blocks, lists,
blockquotes, bold/inline-code) into a formatted document, embeds the rendered
diagram and screenshot PNGs, inserts an auto-updating Table of Contents and
page numbers, and writes report/RMMS_Project_Report.docx.

Usage:  python report/build_docx.py
"""
import os
import re
import struct

from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD_PATH = os.path.join(ROOT, "REPORT.md")
OUT_PATH = os.path.join(ROOT, "report", "RMMS_Project_Report.docx")

MAX_W_IN = 6.3   # usable page width
MAX_H_IN = 8.4   # usable page height

EMOJI = {"✅": "", "❌": "", "🤖": "", "📊": "", "🦾": "", "📅": "", "🛠️": "", "👥": ""}


# ---------- helpers ----------
def png_size(path):
    """Return (width_px, height_px) for a PNG without external libraries."""
    with open(path, "rb") as f:
        head = f.read(26)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", head[16:24])
    return w, h


def strip_emoji(text):
    for k, v in EMOJI.items():
        text = text.replace(k, v)
    return text


def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def add_inline(paragraph, text, base_bold=False):
    """Parse **bold**, `code` and [text](url) into runs."""
    text = strip_emoji(text)
    # Replace markdown links with their visible text (keep URL if it is a bare code link)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    # Tokenise on ** and `
    tokens = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text)
    for tok in tokens:
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            r = paragraph.add_run(tok[2:-2]); r.bold = True
        elif tok.startswith("`") and tok.endswith("`"):
            r = paragraph.add_run(tok[1:-1]); r.font.name = "Consolas"; r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(0xC0, 0x37, 0x2B)
        else:
            r = paragraph.add_run(tok)
        if base_bold:
            r.bold = True


def add_code_block(doc, lines):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.1)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    # light grey shading on the paragraph
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), "F2F2F2")
    pPr.append(shd)
    run = p.add_run("\n".join(lines))
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)


def add_image(doc, path, caption=None):
    if not os.path.exists(path):
        doc.add_paragraph(f"[missing image: {path}]")
        return
    size = png_size(path)
    width = Inches(MAX_W_IN)
    if size:
        w_px, h_px = size
        w_in, h_in = w_px / 96.0, h_px / 96.0
        scale = min(MAX_W_IN / w_in, MAX_H_IN / h_in, 1.5)
        width = Inches(min(w_in * scale, MAX_W_IN))
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path, width=width)


def add_toc_field(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    fldBegin = OxmlElement("w:fldChar"); fldBegin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve")
    instr.text = r'TOC \o "1-2" \h \z \u'
    fldSep = OxmlElement("w:fldChar"); fldSep.set(qn("w:fldCharType"), "separate")
    t = OxmlElement("w:t"); t.text = "Right-click and choose “Update Field” to build the Table of Contents."
    fldEnd = OxmlElement("w:fldChar"); fldEnd.set(qn("w:fldCharType"), "end")
    for e in (fldBegin, instr, fldSep, t, fldEnd):
        run._r.append(e)


def add_page_numbers(doc):
    footer = doc.sections[0].footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run("RMMS · Aaron Joshua · 24BRS1393 · Page ")
    run = p.add_run()
    for typ, txt in (("begin", None), ("instr", "PAGE"), ("separate", "1"), ("end", None)):
        el = OxmlElement("w:fldChar") if typ in ("begin", "separate", "end") else OxmlElement("w:instrText")
        if typ in ("begin", "separate", "end"):
            el.set(qn("w:fldCharType"), typ)
        else:
            el.set(qn("xml:space"), "preserve"); el.text = txt
        run._r.append(el)


def make_table(doc, rows):
    header, body = rows[0], rows[1:]
    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, cell_text in enumerate(header):
        c = table.rows[0].cells[j]
        set_cell_background(c, "2C3747")
        c.paragraphs[0].text = ""
        add_inline(c.paragraphs[0], cell_text)
        for run in c.paragraphs[0].runs:
            run.bold = True; run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); run.font.size = Pt(9.5)
    for row in body:
        cells = table.add_row().cells
        for j in range(len(header)):
            txt = row[j] if j < len(row) else ""
            cells[j].paragraphs[0].text = ""
            add_inline(cells[j].paragraphs[0], txt)
            for run in cells[j].paragraphs[0].runs:
                run.font.size = Pt(9.5)


def split_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


# ---------- main conversion ----------
def build():
    with open(MD_PATH, encoding="utf-8") as f:
        lines = f.read().split("\n")

    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"; normal.font.size = Pt(11)

    section = doc.sections[0]
    section.page_width = Inches(8.27); section.page_height = Inches(11.69)  # A4
    for m in ("left_margin", "right_margin"):
        setattr(section, m, Inches(1.0))
    section.top_margin = Inches(0.9); section.bottom_margin = Inches(0.9)
    add_page_numbers(doc)

    in_title = True          # center everything until the first horizontal rule
    first_h1_seen = False
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # skip raw HTML container tags
        if stripped in ("<div align=\"center\">", "</div>", "<div align='center'>"):
            i += 1
            continue

        # horizontal rule ends the title block; otherwise ignored
        if stripped == "---":
            in_title = False
            i += 1
            continue

        # blank line
        if stripped == "":
            i += 1
            continue

        # code fence
        if stripped.startswith("```"):
            lang = stripped[3:].strip().lower()
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i]); i += 1
            i += 1  # closing fence
            if lang != "mermaid":   # mermaid diagrams are embedded as images instead
                add_code_block(doc, block)
            continue

        # image
        m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
        if m:
            img_path = os.path.join(ROOT, m.group(2).replace("/", os.sep))
            add_image(doc, img_path)
            i += 1
            continue

        # table
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:\-|]+\|?$", lines[i + 1].strip()):
            rows = [split_row(stripped)]
            i += 2  # skip header + separator
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i])); i += 1
            make_table(doc, rows)
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

        # headings
        if stripped.startswith("# "):
            p = doc.add_paragraph(strip_emoji(stripped[2:]), style="Title")
            if in_title:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            i += 1
            continue
        if stripped.startswith("## "):
            title = strip_emoji(stripped[3:]).strip()
            if title.lower() == "table of contents":
                doc.add_page_break()          # title page stands alone
                doc.add_heading(title, level=1)
                add_toc_field(doc)
                first_h1_seen = True          # next section starts on its own page
                # skip the manual TOC list that follows
                i += 1
                while i < len(lines) and (lines[i].strip() == "" or re.match(r"^\d+\.", lines[i].strip())):
                    i += 1
                continue
            if first_h1_seen:
                doc.add_page_break()
            first_h1_seen = True
            doc.add_heading(title, level=1)
            i += 1
            continue
        if stripped.startswith("### "):
            doc.add_heading(strip_emoji(stripped[4:]), level=2)
            i += 1
            continue
        if stripped.startswith("#### "):
            doc.add_heading(strip_emoji(stripped[5:]), level=3)
            i += 1
            continue

        # blockquote
        if stripped.startswith(">"):
            text = stripped.lstrip(">").strip()
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            add_inline(p, text)
            for r in p.runs:
                r.italic = True; r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
            i += 1
            continue

        # bullet list
        if stripped.startswith("- ") or stripped.startswith("* "):
            p = doc.add_paragraph(style="List Bullet")
            add_inline(p, stripped[2:])
            i += 1
            continue

        # numbered list
        m = re.match(r"^(\d+)\.\s+(.*)", stripped)
        if m:
            p = doc.add_paragraph(style="List Number")
            add_inline(p, m.group(2))
            i += 1
            continue

        # plain paragraph
        p = doc.add_paragraph()
        if in_title:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # a line that is only *italic* caption
        if stripped.startswith("*") and stripped.endswith("*") and not stripped.startswith("**"):
            r = p.add_run(strip_emoji(stripped.strip("*"))); r.italic = True
            r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        else:
            add_inline(p, stripped)
        i += 1

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    doc.save(OUT_PATH)
    print("Wrote", OUT_PATH)


if __name__ == "__main__":
    build()
