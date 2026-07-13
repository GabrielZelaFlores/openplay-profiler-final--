from __future__ import annotations

import html
import re
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "guia-completa-defensa-openplay.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "docs" / "guia-completa-defensa-openplay.pdf"

SOURCES = [
    ("Guion de exposición de 8 minutos", ROOT / "README_EXPOSICION.md"),
    ("Definición de tareas según Munzner", ROOT / "docs" / "TAREAS_MUNZNER.md"),
    ("Conceptos para la defensa", ROOT / "docs" / "CONCEPTOS_PARA_DEFENSA.md"),
]


def register_fonts() -> tuple[str, str]:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("GuideSans", regular))
        pdfmetrics.registerFont(TTFont("GuideSans-Bold", bold))
        return "GuideSans", "GuideSans-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()
PAGE_WIDTH, PAGE_HEIGHT = A4
GREEN = colors.HexColor("#284438")
LIGHT_GREEN = colors.HexColor("#EAF1EC")
CREAM = colors.HexColor("#F7F4EC")
BLUE = colors.HexColor("#E9F1F7")
INK = colors.HexColor("#1F2924")
MUTED = colors.HexColor("#607068")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "GuideBody",
        fontName=FONT,
        fontSize=9.4,
        leading=13.2,
        textColor=INK,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        "GuideH1",
        fontName=FONT_BOLD,
        fontSize=19,
        leading=23,
        textColor=GREEN,
        spaceBefore=8,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        "GuideH2",
        fontName=FONT_BOLD,
        fontSize=13.5,
        leading=17,
        textColor=GREEN,
        spaceBefore=12,
        spaceAfter=7,
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        "GuideH3",
        fontName=FONT_BOLD,
        fontSize=11,
        leading=14,
        textColor=INK,
        spaceBefore=8,
        spaceAfter=5,
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        "GuideBullet",
        parent=styles["GuideBody"],
        leftIndent=15,
        firstLineIndent=-9,
        bulletIndent=4,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        "GuideQuote",
        parent=styles["GuideBody"],
        leftIndent=12,
        rightIndent=12,
        borderColor=GREEN,
        borderWidth=0.8,
        borderPadding=8,
        backColor=LIGHT_GREEN,
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        "GuideCode",
        fontName="Courier",
        fontSize=8.2,
        leading=10.5,
        leftIndent=9,
        rightIndent=9,
        borderColor=colors.HexColor("#CBD6D0"),
        borderWidth=0.5,
        borderPadding=7,
        backColor=colors.HexColor("#F2F5F3"),
        spaceBefore=4,
        spaceAfter=8,
    )
)


def normalize(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2011", "-")
        .replace("\u2192", "->")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )


def inline_markup(text: str) -> str:
    value = html.escape(normalize(text.strip()))
    value = re.sub(r"\[([^]]+)\]\(([^)]+)\)", r"<u>\1</u>", value)
    value = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    return value


def table_from_markdown(rows: list[list[str]]) -> Table:
    width = PAGE_WIDTH - 3.4 * cm
    cols = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (cols - len(row)) for row in rows]
    data = [
        [Paragraph(inline_markup(cell), styles["GuideBody"]) for cell in row]
        for row in normalized_rows
    ]
    table = Table(data, colWidths=[width / cols] * cols, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B8C5BE")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CREAM]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def parse_markdown(path: Path) -> list:
    lines = path.read_text(encoding="utf-8").splitlines()
    story: list = []
    i = 0
    paragraph: list[str] = []
    first_h1_seen = False

    def flush_paragraph() -> None:
        if paragraph:
            story.append(Paragraph(inline_markup(" ".join(paragraph)), styles["GuideBody"]))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            code_lines: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(normalize(lines[i]))
                i += 1
            story.append(Preformatted("\n".join(code_lines), styles["GuideCode"]))
        elif stripped.startswith("# "):
            flush_paragraph()
            if first_h1_seen:
                story.append(Paragraph(inline_markup(stripped[2:]), styles["GuideH1"]))
            first_h1_seen = True
        elif stripped.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[3:]), styles["GuideH2"]))
        elif stripped.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[4:]), styles["GuideH3"]))
        elif stripped == "---":
            flush_paragraph()
            story.append(Spacer(1, 3))
            story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#B8C5BE")))
            story.append(Spacer(1, 5))
        elif stripped.startswith(">"):
            flush_paragraph()
            quote: list[str] = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            i -= 1
            story.append(KeepTogether([
                Paragraph(inline_markup(" ".join(quote)), styles["GuideQuote"])
            ]))
        elif re.match(r"^\|.*\|$", stripped):
            flush_paragraph()
            table_rows: list[list[str]] = []
            while i < len(lines) and re.match(r"^\|.*\|$", lines[i].strip()):
                cells = [cell.strip() for cell in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                    table_rows.append(cells)
                i += 1
            i -= 1
            if table_rows:
                story.append(table_from_markdown(table_rows))
                story.append(Spacer(1, 8))
        elif re.match(r"^\s*[-*]\s+", line):
            flush_paragraph()
            content = re.sub(r"^\s*[-*]\s+", "", line)
            story.append(Paragraph(inline_markup(content), styles["GuideBullet"], bulletText="-"))
        elif re.match(r"^\s*\d+\.\s+", line):
            flush_paragraph()
            match = re.match(r"^\s*(\d+)\.\s+(.*)", line)
            assert match
            story.append(
                Paragraph(inline_markup(match.group(2)), styles["GuideBullet"], bulletText=f"{match.group(1)}.")
            )
        elif not stripped:
            flush_paragraph()
            story.append(Spacer(1, 2))
        else:
            paragraph.append(stripped)
        i += 1

    flush_paragraph()
    return story


def page_decor(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 1.05 * cm, PAGE_WIDTH, 1.05 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(FONT_BOLD, 8.5)
    canvas.drawString(1.7 * cm, PAGE_HEIGHT - 0.68 * cm, "OPENPLAY PROFILER - GUIA DE DEFENSA")
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8)
    canvas.drawCentredString(PAGE_WIDTH / 2, 0.72 * cm, f"Página {doc.page}")
    canvas.restoreState()


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    frame = Frame(
        1.7 * cm,
        1.25 * cm,
        PAGE_WIDTH - 3.4 * cm,
        PAGE_HEIGHT - 2.7 * cm,
        id="main",
    )
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=1.7 * cm,
        rightMargin=1.7 * cm,
        topMargin=1.45 * cm,
        bottomMargin=1.25 * cm,
        title="Guía completa de exposición y defensa - OpenPlay Profiler",
        author="OpenPlay Profiler",
    )
    doc.addPageTemplates([PageTemplate(id="guide", frames=[frame], onPage=page_decor)])

    story: list = [
        Spacer(1, 2.2 * cm),
        Paragraph("OpenPlay Profiler", ParagraphStyle(
            "CoverProject", fontName=FONT_BOLD, fontSize=26, leading=30,
            alignment=TA_CENTER, textColor=GREEN, spaceAfter=12,
        )),
        Paragraph("Guía completa de exposición y defensa", ParagraphStyle(
            "CoverTitle", fontName=FONT_BOLD, fontSize=18, leading=23,
            alignment=TA_CENTER, textColor=INK, spaceAfter=18,
        )),
        HRFlowable(width="65%", thickness=1.2, color=GREEN, hAlign="CENTER"),
        Spacer(1, 18),
        Paragraph(
            "Guion cronometrado de 8 minutos, definición de tareas según Munzner, conceptos fundamentales, perfiles encontrados, límites y respuestas probables.",
            ParagraphStyle("CoverText", parent=styles["GuideBody"], fontSize=11, leading=16,
                           alignment=TA_CENTER, leftIndent=1.2 * cm, rightIndent=1.2 * cm),
        ),
        Spacer(1, 1.1 * cm),
        Table(
            [[Paragraph("Contenido", styles["GuideH3"])],
             [Paragraph("1. Recorrido exacto de la exposición", styles["GuideBody"])],
             [Paragraph("2. Tareas analíticas de Munzner aplicadas al proyecto", styles["GuideBody"])],
             [Paragraph("3. Conceptos y respuestas para la defensa", styles["GuideBody"])],
             [Paragraph("4. Conocimiento encontrado y límites de interpretación", styles["GuideBody"])],
             [Paragraph("5. Preguntas probables de la profesora", styles["GuideBody"])]],
            colWidths=[13.5 * cm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GREEN),
                ("BACKGROUND", (0, 1), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#B8C5BE")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D5DED9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]),
        ),
        PageBreak(),
    ]

    for index, (section_title, source) in enumerate(SOURCES):
        if index:
            story.append(CondPageBreak(9 * cm))
        story.append(Paragraph(section_title, styles["GuideH1"]))
        story.append(
            Paragraph(
                f"Fuente integrada: {source.relative_to(ROOT).as_posix()}",
                ParagraphStyle("Source", parent=styles["GuideBody"], fontSize=8.3, textColor=MUTED),
            )
        )
        story.append(HRFlowable(width="100%", thickness=0.8, color=GREEN))
        story.append(Spacer(1, 10))
        story.extend(parse_markdown(source))

    doc.build(story)
    shutil.copy2(OUTPUT, PUBLIC_OUTPUT)
    print(f"PDF generado: {OUTPUT}")
    print(f"Copia pública: {PUBLIC_OUTPUT}")


if __name__ == "__main__":
    build_pdf()
