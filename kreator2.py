from http.server import HTTPServer, BaseHTTPRequestHandler
from email.parser import BytesParser
from email.policy import default
from datetime import datetime
import html
import json
import os
import re
import urllib.parse


PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
POSTS_JSON = os.path.join(PROJECT_DIR, "posts.json")
PROJECTS_JSON = os.path.join(PROJECT_DIR, "projects.json")
PHOTOS_JSON = os.path.join(PROJECT_DIR, "photos.json")
PROJECT_BANNERS_DIR = os.path.join(PROJECT_DIR, "projects", "banners")
PHOTOGRAPHY_DIR = os.path.join(PROJECT_DIR, "photography")


def read_json(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=4)


def next_id(items):
    return max([item.get("id", 0) for item in items], default=0) + 1


def slugify(value):
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "plik"


def safe_ext(filename):
    ext = os.path.splitext(filename or "")[1].lower()
    return ext if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else ".jpg"


def save_upload(file_info, target_dir, base_name):
    filename, content = file_info
    if not filename or not content:
        return ""
    os.makedirs(target_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    final_name = f"{slugify(base_name)}-{stamp}{safe_ext(filename)}"
    target_path = os.path.join(target_dir, final_name)
    with open(target_path, "wb") as file:
        file.write(content)
    return os.path.relpath(target_path, PROJECT_DIR).replace("\\", "/")


def delete_file(file_path):
    if file_path:
        full_path = os.path.join(PROJECT_DIR, file_path)
        if os.path.exists(full_path):
            os.remove(full_path)


def parse_form(handler):
    length = int(handler.headers.get("Content-Length", 0))
    body = handler.rfile.read(length)
    content_type = handler.headers.get("Content-Type", "")

    if content_type.startswith("multipart/form-data"):
        raw_message = (
            f"Content-Type: {content_type}\r\n"
            "MIME-Version: 1.0\r\n\r\n"
        ).encode("utf-8") + body
        message = BytesParser(policy=default).parsebytes(raw_message)
        fields = {}
        files = {}
        for part in message.iter_parts():
            disposition = part.get("Content-Disposition", "")
            if "form-data" not in disposition:
                continue
            name = part.get_param("name", header="content-disposition")
            filename = part.get_filename()
            payload = part.get_payload(decode=True) or b""
            if filename:
                files[name] = (filename, payload)
            elif name:
                charset = part.get_content_charset() or "utf-8"
                fields[name] = payload.decode(charset, errors="replace").strip()
        return fields, files

    parsed = urllib.parse.parse_qs(body.decode("utf-8", errors="replace"))
    return {key: values[0].strip() for key, values in parsed.items()}, {}


def status_box(kind, text):
    if not text:
        return ""
    icon = "fa-check-circle" if kind == "success" else "fa-triangle-exclamation"
    return f'<div class="status-msg {kind}"><i class="fas {icon}"></i>{html.escape(text)}</div>'


def render_manage_section(items, item_type):
    if not items:
        return '<div class="empty-state"><p class="muted">Brak elementów do wyświetlenia</p></div>'
    
    html_parts = ['<div class="manage-grid">']
    for item in items:
        item_id = item.get("id", 0)
        html_parts.append(f'<div class="manage-item" data-id="{item_id}">')
        html_parts.append(f'<div class="manage-header">')
        html_parts.append(f'<span class="item-title">{html.escape(str(item.get("title", "")))}</span>')
        html_parts.append(f'<div class="item-actions">')
        html_parts.append(f'<button class="edit-btn" onclick="editItem({item_id}, \'{item_type}\')"><i class="fas fa-edit"></i></button>')
        html_parts.append(f'<button class="delete-btn" onclick="deleteItem({item_id}, \'{item_type}\')"><i class="fas fa-trash"></i></button>')
        html_parts.append(f'</div></div>')
        
        if item_type == "post":
            html_parts.append(f'<div class="item-details"><span class="date">{html.escape(str(item.get("date", "")))}</span></div>')
            content_preview = str(item.get("content", ""))[:200]
            html_parts.append(f'<div class="item-preview">{html.escape(content_preview)}...</div>')
        elif item_type == "project":
            html_parts.append(f'<div class="item-details"><span class="status">{html.escape(str(item.get("status", "")))}</span>')
            if item.get("url"):
                html_parts.append(f'<a href="{html.escape(str(item.get("url", "#")))}" target="_blank"><i class="fas fa-external-link-alt"></i></a>')
            html_parts.append(f'</div>')
            if item.get("banner"):
                banner_path = item.get("banner", "")
                if not banner_path.startswith("projects/banners/"):
                    banner_path = f"projects/banners/{banner_path}" if not banner_path.startswith("/") else banner_path
                html_parts.append(f'<img src="/{html.escape(banner_path)}" class="item-thumb" alt="{html.escape(str(item.get("title", "")))}">')
            description_preview = str(item.get("description", ""))[:150]
            html_parts.append(f'<div class="item-preview">{html.escape(description_preview)}...</div>')
        elif item_type == "photo":
            html_parts.append(f'<div class="item-details"><span class="location">{html.escape(str(item.get("location", "")))}</span></div>')
            if item.get("image"):
                image_path = item.get("image", "")
                if not image_path.startswith("photography/"):
                    image_path = f"photography/{image_path}" if not image_path.startswith("/") else image_path
                html_parts.append(f'<img src="/{html.escape(image_path)}" class="item-thumb" alt="{html.escape(str(item.get("alt", "")))}">')
        
        html_parts.append('</div>')
    
    html_parts.append('</div>')
    return ''.join(html_parts)


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kreator treści | Nozer</title>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    
    <style>
        :root {
            --bg: #0c0d0e;
            --card: #16171a;
            --input: #1e1f23;
            --border: rgba(255,255,255,0.08);
            --text: #f4f4f5;
            --muted: #9ca3af;
            --accent: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: Inter, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem 1rem;
        }

        .main-wrapper {
            width: min(100%, 1120px);
            margin: 0 auto;
            display: grid;
            gap: 1.25rem;
        }

        .top-nav,
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px;
        }

        .top-nav {
            border-radius: 999px;
            padding: 0.75rem 1.25rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-weight: 800;
        }

        .brand i { color: var(--accent); }

        .nav-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .nav-btn {
            border: 0;
            background: rgba(255,255,255,0.05);
            color: var(--muted);
            border-radius: 999px;
            padding: 8px 16px;
            cursor: pointer;
            font: inherit;
            font-size: 0.84rem;
            font-weight: 700;
            display: inline-flex;
            gap: 8px;
            align-items: center;
            transition: all 0.2s;
        }

        .nav-btn.active {
            background: var(--text);
            color: #000;
        }

        .nav-btn:hover {
            background: rgba(255,255,255,0.1);
        }

        .nav-btn.active:hover {
            opacity: 0.9;
        }

        .card {
            padding: 1.5rem;
            display: grid;
            gap: 1.15rem;
        }

        .card-header h1 {
            font-size: 1.8rem;
            line-height: 1.1;
            margin-bottom: 0.3rem;
        }

        .card-header p {
            color: var(--muted);
            font-size: 0.92rem;
        }

        .status-msg {
            border: 1px solid var(--accent);
            background: rgba(16,185,129,0.12);
            color: var(--accent);
            padding: 0.85rem 1rem;
            border-radius: 12px;
            display: flex;
            gap: 10px;
            align-items: center;
            font-weight: 700;
            font-size: 0.9rem;
        }

        .status-msg.error {
            border-color: var(--danger);
            background: rgba(239,68,68,0.12);
            color: #fca5a5;
        }

        .view-section {
            display: none;
        }

        .view-section.active {
            display: block;
        }

        .form-panel {
            display: none;
            gap: 1rem;
        }

        .form-panel.active {
            display: grid;
        }

        .field-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
        }

        .field-group {
            display: grid;
            gap: 0.5rem;
        }

        .span-2 { grid-column: 1 / -1; }

        label {
            color: var(--muted);
            font-size: 0.74rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        input,
        textarea,
        select {
            width: 100%;
            border: 1px solid var(--border);
            background: var(--input);
            color: var(--text);
            border-radius: 12px;
            padding: 13px 15px;
            font: inherit;
            outline: none;
        }

        input:focus,
        textarea:focus,
        select:focus {
            border-color: var(--accent);
        }

        input[type="file"] {
            padding: 11px;
        }

        textarea {
            min-height: 260px;
            resize: vertical;
        }

        .markdown-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 1rem;
        }

        .preview-box {
            min-height: 260px;
            padding: 14px;
            border: 1px solid var(--border);
            background: var(--input);
            border-radius: 12px;
            overflow: auto;
            color: #d4d4d8;
            line-height: 1.65;
        }

        .preview-box h1,
        .preview-box h2,
        .preview-box h3 { margin: 0.8rem 0 0.35rem; color: #fff; }
        .preview-box p { margin-bottom: 0.75rem; }
        .preview-box a { color: var(--accent); }
        .preview-box code { font-family: "Fira Code", monospace; }

        .btn-submit {
            border: 0;
            background: var(--text);
            color: #000;
            border-radius: 999px;
            padding: 14px 18px;
            font: inherit;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .btn-submit:hover { opacity: 0.9; }

        .manage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
        }

        .manage-item {
            background: var(--input);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1rem;
            display: grid;
            gap: 0.5rem;
        }

        .manage-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            gap: 0.5rem;
        }

        .item-title {
            font-weight: 700;
            font-size: 1.1rem;
        }

        .item-actions {
            display: flex;
            gap: 0.3rem;
        }

        .edit-btn,
        .delete-btn {
            border: 0;
            background: rgba(255,255,255,0.05);
            color: var(--muted);
            border-radius: 8px;
            padding: 6px 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .edit-btn:hover {
            background: rgba(16,185,129,0.2);
            color: var(--accent);
        }

        .delete-btn:hover {
            background: rgba(239,68,68,0.2);
            color: var(--danger);
        }

        .item-details {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            color: var(--muted);
            font-size: 0.85rem;
        }

        .item-details a {
            color: var(--accent);
            text-decoration: none;
        }

        .item-thumb {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            background: var(--bg);
        }

        .item-preview {
            color: var(--muted);
            font-size: 0.85rem;
            line-height: 1.4;
            opacity: 0.8;
        }

        .empty-state {
            text-align: center;
            padding: 3rem;
            color: var(--muted);
        }

        .muted { color: var(--muted); }

        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            padding: 1rem;
        }

        .modal-overlay.active {
            display: flex;
        }

        .modal {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 1.5rem;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .modal-close {
            border: 0;
            background: transparent;
            color: var(--muted);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0 0.5rem;
        }

        .modal-close:hover {
            color: var(--text);
        }

        .type-switcher {
            display: flex;
            gap: 6px;
            padding: 4px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: rgba(255,255,255,0.03);
            flex-wrap: wrap;
            margin-bottom: 1rem;
        }

        .type-btn {
            border: 0;
            background: transparent;
            color: var(--muted);
            border-radius: 999px;
            padding: 8px 13px;
            cursor: pointer;
            font: inherit;
            font-size: 0.84rem;
            font-weight: 700;
            display: inline-flex;
            gap: 8px;
            align-items: center;
        }

        .type-btn.active {
            background: var(--text);
            color: #000;
        }

        .manage-type-btn {
            border: 0;
            background: transparent;
            color: var(--muted);
            border-radius: 999px;
            padding: 8px 13px;
            cursor: pointer;
            font: inherit;
            font-size: 0.84rem;
            font-weight: 700;
            display: inline-flex;
            gap: 8px;
            align-items: center;
        }

        .manage-type-btn.active {
            background: var(--text);
            color: #000;
        }

        /* Edytor Markdown - style */
        .markdown-editor-wrapper {
            grid-column: 1 / -1;
            display: grid;
            gap: 0.5rem;
        }

        .editor-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            padding: 6px 8px;
            background: var(--input);
            border: 1px solid var(--border);
            border-radius: 12px 12px 0 0;
            border-bottom: none;
            align-items: center;
        }

        .editor-toolbar button {
            background: transparent;
            border: none;
            color: var(--muted);
            padding: 5px 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
            font-weight: 500;
            min-width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .editor-toolbar button:hover {
            background: rgba(255,255,255,0.08);
            color: var(--text);
        }

        .editor-toolbar button.active {
            background: rgba(16,185,129,0.2);
            color: var(--accent);
        }

        .toolbar-divider {
            width: 1px;
            height: 24px;
            background: var(--border);
            margin: 0 3px;
        }

        .word-count, .char-count {
            color: var(--muted);
            font-size: 0.75rem;
            font-weight: 500;
            margin-left: auto;
            padding: 0 8px;
        }

        #post-content {
            border-radius: 0 0 12px 12px;
            min-height: 300px;
            font-family: 'Fira Code', monospace;
            font-size: 0.9rem;
            line-height: 1.6;
            resize: vertical;
        }

        #post-content:focus {
            border-color: var(--accent);
        }

        .preview-box {
            min-height: 300px;
        }

        @media (max-width: 760px) {
            body { padding: 1rem; }
            .top-nav {
                align-items: stretch;
                border-radius: 20px;
                flex-direction: column;
            }
            .nav-actions { flex-wrap: wrap; }
            .nav-btn { width: 100%; justify-content: center; }
            .field-grid,
            .markdown-layout { grid-template-columns: 1fr; }
            .manage-grid { grid-template-columns: 1fr; }
            .editor-toolbar button {
                padding: 4px 6px;
                font-size: 0.8rem;
                min-width: 24px;
                height: 24px;
            }
            .word-count, .char-count {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="main-wrapper">
        <!-- Nawigacja górna -->
        <div class="top-nav">
            <div class="brand">
                <i class="fas fa-wand-magic-sparkles"></i>
                <span>Kreator treści</span>
            </div>
            <div class="nav-actions">
                <button class="nav-btn active" onclick="switchView('create')"><i class="fas fa-plus"></i> Dodaj</button>
                <button class="nav-btn" onclick="switchView('manage')"><i class="fas fa-list"></i> Zarządzaj</button>
            </div>
        </div>

        <!-- Główna karta -->
        <section class="card">
            <!-- Widok: Dodawanie -->
            <div id="create-view" class="view-section active">
                <div class="card-header">
                    <h1>Dodaj nową pozycję</h1>
                    <p>Wybierz typ treści, uzupełnij dane i wyślij plik.</p>
                </div>

                {{STATUS_PLACEHOLDER}}

                <div class="type-switcher">
                    <button class="type-btn active" type="button" data-panel="post"><i class="fas fa-pen-nib"></i> Wpis</button>
                    <button class="type-btn" type="button" data-panel="project"><i class="fas fa-folder-open"></i> Projekt</button>
                    <button class="type-btn" type="button" data-panel="photo"><i class="fas fa-camera"></i> Fotografia</button>
                </div>

                <!-- Formularz: Wpis -->
                <form action="/add" method="POST" enctype="multipart/form-data" class="form-panel active" data-form-panel="post">
                    <input type="hidden" name="content_type" value="post">
                    <div class="field-group">
                        <label>Tytuł wpisu</label>
                        <input type="text" name="title" placeholder="Tytuł notatki..." required>
                    </div>
                    
                    <div class="markdown-editor-wrapper">
                        <div class="editor-toolbar">
                            <button type="button" onclick="insertFormat('bold')" title="Pogrubienie (Ctrl+B)"><i class="fas fa-bold"></i></button>
                            <button type="button" onclick="insertFormat('italic')" title="Kursywa (Ctrl+I)"><i class="fas fa-italic"></i></button>
                            <button type="button" onclick="insertFormat('strikethrough')" title="Przekreślenie"><i class="fas fa-strikethrough"></i></button>
                            <button type="button" onclick="insertFormat('underline')" title="Podkreślenie"><i class="fas fa-underline"></i></button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('h1')" title="Nagłówek 1">H1</button>
                            <button type="button" onclick="insertFormat('h2')" title="Nagłówek 2">H2</button>
                            <button type="button" onclick="insertFormat('h3')" title="Nagłówek 3">H3</button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('link')" title="Link (Ctrl+K)"><i class="fas fa-link"></i></button>
                            <button type="button" onclick="insertFormat('image')" title="Obraz"><i class="fas fa-image"></i></button>
                            <button type="button" onclick="insertFormat('video')" title="Wideo"><i class="fas fa-video"></i></button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('ul')" title="Lista nienumerowana"><i class="fas fa-list-ul"></i></button>
                            <button type="button" onclick="insertFormat('ol')" title="Lista numerowana"><i class="fas fa-list-ol"></i></button>
                            <button type="button" onclick="insertFormat('task')" title="Lista zadań"><i class="fas fa-tasks"></i></button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('code')" title="Kod inline"><i class="fas fa-code"></i></button>
                            <button type="button" onclick="insertFormat('codeblock')" title="Blok kodu"><i class="fas fa-code-branch"></i></button>
                            <button type="button" onclick="insertFormat('quote')" title="Cytat"><i class="fas fa-quote-right"></i></button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('hr')" title="Linia pozioma"><i class="fas fa-minus"></i></button>
                            <button type="button" onclick="insertFormat('table')" title="Tabela"><i class="fas fa-table"></i></button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('emoji')" title="Emoji"><i class="fas fa-smile"></i></button>
                            <button type="button" onclick="insertFormat('timestamp')" title="Data i czas"><i class="fas fa-clock"></i></button>
                            <span class="toolbar-divider"></span>
                            <button type="button" onclick="insertFormat('template')" title="Szablon"><i class="fas fa-file-alt"></i></button>
                            <button type="button" onclick="clearFormatting()" title="Wyczyść formatowanie"><i class="fas fa-eraser"></i></button>
                            <button type="button" onclick="togglePreview()" title="Przełącz podgląd"><i class="fas fa-eye"></i></button>
                            <span class="toolbar-divider"></span>
                            <span class="word-count" id="wordCount">0 słów</span>
                            <span class="char-count" id="charCount">0 znaków</span>
                        </div>
                        
                        <div class="markdown-layout">
                            <div class="field-group">
                                <textarea id="post-content" name="content" placeholder="Napisz treść wpisu..." required></textarea>
                            </div>
                            <div class="field-group">
                                <label>Podgląd</label>
                                <div class="preview-box" id="preview-box"></div>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn-submit"><i class="fas fa-paper-plane"></i> Opublikuj wpis</button>
                </form>

                <!-- Formularz: Projekt -->
                <form action="/add" method="POST" enctype="multipart/form-data" class="form-panel" data-form-panel="project">
                    <input type="hidden" name="content_type" value="project">
                    <div class="field-grid">
                        <div class="field-group">
                            <label>Nazwa projektu</label>
                            <input type="text" name="title" placeholder="Nazwa projektu..." required>
                        </div>
                        <div class="field-group">
                            <label>Link do projektu</label>
                            <input type="url" name="url" placeholder="https://..." required>
                        </div>
                        <div class="field-group">
                            <label>Status</label>
                            <input type="text" name="status" value="Operacyjny" required>
                        </div>
                        <div class="field-group">
                            <label>Banner projektu</label>
                            <input type="file" name="banner" accept="image/*" required>
                        </div>
                        <div class="field-group span-2">
                            <label>Opis projektu</label>
                            <textarea name="description" placeholder="Krótki opis projektu..." required></textarea>
                        </div>
                    </div>
                    <button type="submit" class="btn-submit"><i class="fas fa-upload"></i> Dodaj projekt</button>
                </form>

                <!-- Formularz: Fotografia -->
                <form action="/add" method="POST" enctype="multipart/form-data" class="form-panel" data-form-panel="photo">
                    <input type="hidden" name="content_type" value="photo">
                    <div class="field-grid">
                        <div class="field-group">
                            <label>Tytuł zdjęcia</label>
                            <input type="text" name="title" placeholder="Tytuł fotografii..." required>
                        </div>
                        <div class="field-group">
                            <label>Lokalizacja</label>
                            <input type="text" name="location" placeholder="Miasto, kraj..." required>
                        </div>
                        <div class="field-group span-2">
                            <label>Fotografia</label>
                            <input type="file" name="photo" accept="image/*" required>
                        </div>
                    </div>
                    <button type="submit" class="btn-submit"><i class="fas fa-upload"></i> Dodaj fotografię</button>
                </form>
            </div>

            <!-- Widok: Zarządzanie -->
            <div id="manage-view" class="view-section">
                <div class="card-header">
                    <h1>Zarządzaj treściami</h1>
                    <p>Przeglądaj, edytuj i usuwaj istniejące wpisy, projekty i fotografie.</p>
                </div>

                <div class="type-switcher">
                    <button class="manage-type-btn active" type="button" data-type="posts"><i class="fas fa-pen-nib"></i> Wpisy</button>
                    <button class="manage-type-btn" type="button" data-type="projects"><i class="fas fa-folder-open"></i> Projekty</button>
                    <button class="manage-type-btn" type="button" data-type="photos"><i class="fas fa-camera"></i> Fotografie</button>
                </div>

                <div id="manage-content">
                    {{MANAGE_CONTENT}}
                </div>
            </div>
        </section>
    </div>

    <!-- Modal edycji -->
    <div id="edit-modal" class="modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h2 id="modal-title">Edytuj</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="edit-form" action="/edit" method="POST" enctype="multipart/form-data">
                <input type="hidden" name="content_type" id="edit-content-type">
                <input type="hidden" name="item_id" id="edit-item-id">
                <div id="edit-fields"></div>
                <button type="submit" class="btn-submit"><i class="fas fa-save"></i> Zapisz zmiany</button>
            </form>
        </div>
    </div>

    <script>
        // ==========================================
        // PODSTAWOWE FUNKCJE
        // ==========================================
        
        // Przełączanie widoków
        function switchView(view) {
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            document.getElementById(view + '-view').classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
            document.querySelector(`.nav-btn[onclick*="${view}"]`).classList.add('active');
            
            // Jeśli przełączamy na zarządzanie, załaduj aktualne dane
            if (view === 'manage') {
                loadManageContent(currentManageType);
            }
        }

        // Przełączanie typów w widoku dodawania
        const typeButtons = document.querySelectorAll('.type-btn');
        const panels = document.querySelectorAll('[data-form-panel]');

        typeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const panelName = button.dataset.panel;
                typeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.panel === panelName));
                panels.forEach(panel => panel.classList.toggle('active', panel.dataset.formPanel === panelName));
            });
        });

        // ==========================================
        // EDYTOR MARKDOWN
        // ==========================================
        
        const contentInput = document.getElementById('post-content');
        const previewBox = document.getElementById('preview-box');

        function updatePreview() {
            const emptyText = '<span style="color: var(--muted); font-style: italic;">Podgląd pojawi się tutaj...</span>';
            if (contentInput) {
                previewBox.innerHTML = marked.parse(contentInput.value || emptyText);
            }
        }

        function updateStats() {
            if (!contentInput) return;
            const text = contentInput.value;
            const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
            const chars = text.length;
            document.getElementById('wordCount').textContent = `${words} słów`;
            document.getElementById('charCount').textContent = `${chars} znaków`;
        }

        // Funkcje formatowania
        function insertFormat(type) {
            if (!contentInput) return;
            const textarea = contentInput;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);
            const before = textarea.value.substring(0, start);
            const after = textarea.value.substring(end);
            
            let newText = '';
            let cursorOffset = 0;
            
            switch(type) {
                case 'bold':
                    newText = `**${selectedText || 'pogrubiony tekst'}**`;
                    cursorOffset = selectedText ? 2 : 2;
                    break;
                case 'italic':
                    newText = `*${selectedText || 'kursywa'}*`;
                    cursorOffset = selectedText ? 1 : 1;
                    break;
                case 'strikethrough':
                    newText = `~~${selectedText || 'przekreślony tekst'}~~`;
                    cursorOffset = selectedText ? 2 : 2;
                    break;
                case 'underline':
                    newText = `__${selectedText || 'podkreślony tekst'}__`;
                    cursorOffset = selectedText ? 2 : 2;
                    break;
                case 'h1':
                    newText = `# ${selectedText || 'Nagłówek 1'}`;
                    cursorOffset = 2;
                    break;
                case 'h2':
                    newText = `## ${selectedText || 'Nagłówek 2'}`;
                    cursorOffset = 3;
                    break;
                case 'h3':
                    newText = `### ${selectedText || 'Nagłówek 3'}`;
                    cursorOffset = 4;
                    break;
                case 'link':
                    const url = prompt('Wprowadź URL:', 'https://');
                    if (url) {
                        newText = `[${selectedText || 'tekst linku'}](${url})`;
                        cursorOffset = selectedText ? 0 : 1;
                    }
                    break;
                case 'image':
                    const imgUrl = prompt('Wprowadź URL obrazu:', 'https://');
                    const altText = prompt('Tekst alternatywny:', 'opis obrazu');
                    if (imgUrl) {
                        newText = `![${altText || 'obraz'}](${imgUrl})`;
                        cursorOffset = 4;
                    }
                    break;
                case 'video':
                    const videoUrl = prompt('Wprowadź URL wideo (YouTube/Vimeo):', 'https://www.youtube.com/watch?v=');
                    if (videoUrl) {
                        newText = `<iframe src="${videoUrl}" frameborder="0" allowfullscreen></iframe>`;
                        cursorOffset = 0;
                    }
                    break;
                case 'ul':
                    const ulItems = selectedText.split('\\n').filter(line => line.trim());
                    if (ulItems.length > 1) {
                        newText = ulItems.map(item => `- ${item}`).join('\\n');
                    } else {
                        newText = `- ${selectedText || 'element listy'}`;
                    }
                    cursorOffset = 2;
                    break;
                case 'ol':
                    const olItems = selectedText.split('\\n').filter(line => line.trim());
                    if (olItems.length > 1) {
                        newText = olItems.map((item, i) => `${i+1}. ${item}`).join('\\n');
                    } else {
                        newText = `1. ${selectedText || 'element listy'}`;
                    }
                    cursorOffset = 3;
                    break;
                case 'task':
                    newText = `- [ ] ${selectedText || 'zadanie do wykonania'}`;
                    cursorOffset = 6;
                    break;
                case 'code':
                    newText = `\`${selectedText || 'kod'}\``;
                    cursorOffset = selectedText ? 1 : 1;
                    break;
                case 'codeblock':
                    const lang = prompt('Język programowania (opcjonalnie):', 'javascript');
                    if (lang) {
                        newText = `\`\`\`${lang}\\n${selectedText || '// Twój kod tutaj'}\\n\`\`\``;
                    } else {
                        newText = `\`\`\`\\n${selectedText || '// Twój kod tutaj'}\\n\`\`\``;
                    }
                    cursorOffset = 4;
                    break;
                case 'quote':
                    newText = `> ${selectedText || 'cytat'}`;
                    cursorOffset = 2;
                    break;
                case 'hr':
                    newText = '\\n---\\n';
                    cursorOffset = 4;
                    break;
                case 'table':
                    newText = `| Nagłówek 1 | Nagłówek 2 | Nagłówek 3 |\\n|-----------|-----------|-----------|\\n| Komórka 1 | Komórka 2 | Komórka 3 |\\n| Komórka 4 | Komórka 5 | Komórka 6 |`;
                    cursorOffset = 0;
                    break;
                case 'emoji':
                    showEmojiPicker();
                    return;
                case 'timestamp':
                    const now = new Date();
                    const timestamp = now.toISOString().slice(0, 10);
                    newText = timestamp;
                    cursorOffset = 0;
                    break;
                case 'template':
                    showTemplatePicker();
                    return;
                default:
                    return;
            }
            
            if (newText) {
                textarea.value = before + newText + after;
                const newCursorPos = start + newText.length - cursorOffset;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                textarea.focus();
                updatePreview();
                updateStats();
            }
        }

        // Emoji picker
        function showEmojiPicker() {
            const emojis = ['😊', '😂', '🤣', '❤️', '💕', '✨', '🔥', '💡', '🌟', '⭐', '👍', '👏', '🙌', '🎉', '🎊', '💪', '🤝', '🌈', '☀️', '🌙', '⭐', '🌍', '🌎', '🌏'];
            const picker = document.createElement('div');
            picker.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 18px;
                padding: 20px;
                z-index: 9999;
                max-width: 400px;
                max-height: 400px;
                overflow-y: auto;
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 8px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            `;
            
            emojis.forEach(emoji => {
                const btn = document.createElement('button');
                btn.textContent = emoji;
                btn.style.cssText = `
                    background: transparent;
                    border: none;
                    font-size: 2rem;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    transition: all 0.2s;
                `;
                btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.08)';
                btn.onmouseout = () => btn.style.background = 'transparent';
                btn.onclick = () => {
                    const textarea = contentInput;
                    const start = textarea.selectionStart;
                    const before = textarea.value.substring(0, start);
                    const after = textarea.value.substring(start);
                    textarea.value = before + emoji + after;
                    textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                    textarea.focus();
                    updatePreview();
                    updateStats();
                    picker.remove();
                };
                picker.appendChild(btn);
            });
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕ Zamknij';
            closeBtn.style.cssText = `
                grid-column: 1 / -1;
                background: var(--danger);
                color: white;
                border: none;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
            `;
            closeBtn.onclick = () => picker.remove();
            picker.appendChild(closeBtn);
            
            document.body.appendChild(picker);
        }

        // Template picker
        function showTemplatePicker() {
            const templates = [
                { name: 'Blog', content: `# Tytuł artykułu\\n\\n## Wprowadzenie\\nTutaj napisz wprowadzenie...\\n\\n## Główna część\\nRozwiń temat...\\n\\n### Podpunkty\\n- Punkt 1\\n- Punkt 2\\n- Punkt 3\\n\\n## Podsumowanie\\nPodsumuj artykuł...` },
                { name: 'Poradnik', content: `# Tytuł poradnika\\n\\n## Cel\\nCo chcesz osiągnąć?\\n\\n## Krok 1: Przygotowanie\\n\`\`\`javascript\\n// Kod przygotowawczy\\n\`\`\`\\n\\n## Krok 2: Implementacja\\n\`\`\`javascript\\n// Główny kod\\n\`\`\`\\n\\n## Krok 3: Testowanie\\n\`\`\`javascript\\n// Testy\\n\`\`\`\\n\\n## Podsumowanie\\nCo udało się osiągnąć?` },
                { name: 'Recenzja', content: `# Recenzja\\n\\n## Ocena ogólna: ⭐⭐⭐⭐⭐\\n\\n### Plusy:\\n- Plus 1\\n- Plus 2\\n\\n### Minusy:\\n- Minus 1\\n- Minus 2\\n\\n## Podsumowanie\\nKońcowa ocena...` }
            ];
            
            const picker = document.createElement('div');
            picker.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 18px;
                padding: 20px;
                z-index: 9999;
                min-width: 300px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            `;
            
            picker.innerHTML = `<h3 style="margin-bottom:15px;">Wybierz szablon</h3>`;
            
            templates.forEach(t => {
                const btn = document.createElement('button');
                btn.textContent = t.name;
                btn.style.cssText = `
                    display: block;
                    width: 100%;
                    padding: 12px;
                    margin: 5px 0;
                    background: var(--input);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text);
                    cursor: pointer;
                    font-size: 1rem;
                    text-align: left;
                    transition: all 0.2s;
                `;
                btn.onmouseover = () => btn.style.borderColor = 'var(--accent)';
                btn.onmouseout = () => btn.style.borderColor = 'var(--border)';
                btn.onclick = () => {
                    const textarea = contentInput;
                    const start = textarea.selectionStart;
                    const before = textarea.value.substring(0, start);
                    const after = textarea.value.substring(start);
                    textarea.value = before + t.content + after;
                    textarea.setSelectionRange(start + t.content.length, start + t.content.length);
                    textarea.focus();
                    updatePreview();
                    updateStats();
                    picker.remove();
                };
                picker.appendChild(btn);
            });
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕ Zamknij';
            closeBtn.style.cssText = `
                display: block;
                width: 100%;
                padding: 12px;
                margin-top: 10px;
                background: var(--danger);
                border: none;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-weight: 700;
            `;
            closeBtn.onclick = () => picker.remove();
            picker.appendChild(closeBtn);
            
            document.body.appendChild(picker);
        }

        function clearFormatting() {
            if (!contentInput) return;
            const textarea = contentInput;
            const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
            
            if (selected) {
                let clean = selected
                    .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
                    .replace(/\\*(.*?)\\*/g, '$1')
                    .replace(/~~(.*?)~~/g, '$1')
                    .replace(/__(.*?)__/g, '$1')
                    .replace(/\`(.*?)\`/g, '$1')
                    .replace(/\\[(.*?)\\]\\(.*?\\)/g, '$1')
                    .replace(/!\\[(.*?)\\]\\(.*?\\)/g, '$1')
                    .replace(/^#+\\s+(.*)/gm, '$1')
                    .replace(/^-\\s+(.*)/gm, '$1')
                    .replace(/^\\d+\\.\\s+(.*)/gm, '$1')
                    .replace(/^>\\s+(.*)/gm, '$1');
                
                const start = textarea.selectionStart;
                const before = textarea.value.substring(0, start);
                const after = textarea.value.substring(textarea.selectionEnd);
                textarea.value = before + clean + after;
                textarea.setSelectionRange(start, start + clean.length);
                updatePreview();
                updateStats();
            }
        }

        let previewVisible = true;
        function togglePreview() {
            previewVisible = !previewVisible;
            const previewBox = document.getElementById('preview-box');
            previewBox.style.display = previewVisible ? 'block' : 'none';
        }

        // Obsługa drag and drop dla obrazów
        if (contentInput) {
            contentInput.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.style.borderColor = 'var(--accent)';
            });

            contentInput.addEventListener('dragleave', function(e) {
                e.preventDefault();
                this.style.borderColor = '';
            });

            contentInput.addEventListener('drop', function(e) {
                e.preventDefault();
                this.style.borderColor = '';
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    const file = files[0];
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const imgData = event.target.result;
                        const markdown = `![${file.name}](${imgData})`;
                        const start = this.selectionStart;
                        const before = this.value.substring(0, start);
                        const after = this.value.substring(start);
                        this.value = before + markdown + after;
                        this.setSelectionRange(start + markdown.length, start + markdown.length);
                        updatePreview();
                        updateStats();
                    }.bind(this);
                    reader.readAsDataURL(file);
                }
            });

            // Wklejanie obrazów
            contentInput.addEventListener('paste', function(e) {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        const reader = new FileReader();
                        reader.onload = function(event) {
                            const imgData = event.target.result;
                            const markdown = `![obraz](${imgData})`;
                            const start = this.selectionStart;
                            const before = this.value.substring(0, start);
                            const after = this.value.substring(start);
                            this.value = before + markdown + after;
                            this.setSelectionRange(start + markdown.length, start + markdown.length);
                            updatePreview();
                            updateStats();
                        }.bind(this);
                        reader.readAsDataURL(file);
                        e.preventDefault();
                        break;
                    }
                }
            });

            // Skróty klawiszowe
            document.addEventListener('keydown', function(e) {
                if (!e.ctrlKey && !e.metaKey) return;
                if (document.activeElement !== contentInput) return;
                
                e.preventDefault();
                
                switch(e.key) {
                    case 'b': insertFormat('bold'); break;
                    case 'i': insertFormat('italic'); break;
                    case 'k': insertFormat('link'); break;
                    case '1': insertFormat('h1'); break;
                    case '2': insertFormat('h2'); break;
                    case '3': insertFormat('h3'); break;
                }
            });

            // Aktualizacja preview i statystyk
            contentInput.addEventListener('input', function() {
                updatePreview();
                updateStats();
            });

            // Inicjalizacja
            updatePreview();
            updateStats();
        }

        // ==========================================
        // ZARZĄDZANIE TREŚCIAMI
        // ==========================================
        
        let currentManageType = 'posts';
        let isLoading = false;

        document.querySelectorAll('.manage-type-btn').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('.manage-type-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentManageType = this.dataset.type;
                loadManageContent(currentManageType);
            });
        });

        function loadManageContent(type) {
            if (isLoading) return;
            isLoading = true;
            
            fetch(`/manage?type=${type}`)
                .then(response => response.text())
                .then(html => {
                    document.getElementById('manage-content').innerHTML = html;
                    isLoading = false;
                })
                .catch(error => {
                    console.error('Error loading content:', error);
                    isLoading = false;
                });
        }

        // ==========================================
        // EDYCJA I USUWANIE
        // ==========================================
        
        function editItem(id, type) {
            const modal = document.getElementById('edit-modal');
            modal.classList.add('active');
            
            document.getElementById('edit-content-type').value = type;
            document.getElementById('edit-item-id').value = id;
            document.getElementById('modal-title').textContent = `Edytuj ${getTypeLabel(type)}`;

            fetch(`/get_item?type=${type}&id=${id}`)
                .then(response => response.json())
                .then(data => {
                    const fields = document.getElementById('edit-fields');
                    fields.innerHTML = '';
                    
                    if (type === 'post') {
                        fields.innerHTML = `
                            <div class="field-group">
                                <label>Tytuł</label>
                                <input type="text" name="title" value="${htmlEscape(data.title)}" required>
                            </div>
                            <div class="field-group">
                                <label>Treść</label>
                                <textarea name="content" rows="10" required>${htmlEscape(data.content)}</textarea>
                            </div>
                        `;
                    } else if (type === 'project') {
                        fields.innerHTML = `
                            <div class="field-group">
                                <label>Nazwa</label>
                                <input type="text" name="title" value="${htmlEscape(data.title)}" required>
                            </div>
                            <div class="field-group">
                                <label>URL</label>
                                <input type="url" name="url" value="${htmlEscape(data.url)}" required>
                            </div>
                            <div class="field-group">
                                <label>Status</label>
                                <input type="text" name="status" value="${htmlEscape(data.status)}" required>
                            </div>
                            <div class="field-group">
                                <label>Nowy banner (opcjonalny)</label>
                                <input type="file" name="banner" accept="image/*">
                            </div>
                            <div class="field-group span-2">
                                <label>Opis</label>
                                <textarea name="description" rows="5" required>${htmlEscape(data.description)}</textarea>
                            </div>
                        `;
                        if (data.banner) {
                            const bannerPath = data.banner.startsWith('projects/banners/') ? data.banner : `projects/banners/${data.banner}`;
                            fields.innerHTML += `
                                <div class="field-group span-2">
                                    <label>Aktualny banner</label>
                                    <img src="/${htmlEscape(bannerPath)}" style="max-width:100%;max-height:200px;border-radius:8px;">
                                </div>
                            `;
                        }
                    } else if (type === 'photo') {
                        fields.innerHTML = `
                            <div class="field-group">
                                <label>Tytuł</label>
                                <input type="text" name="title" value="${htmlEscape(data.title)}" required>
                            </div>
                            <div class="field-group">
                                <label>Lokalizacja</label>
                                <input type="text" name="location" value="${htmlEscape(data.location)}" required>
                            </div>
                            <div class="field-group">
                                <label>Nowe zdjęcie (opcjonalne)</label>
                                <input type="file" name="photo" accept="image/*">
                            </div>
                        `;
                        if (data.image) {
                            const imagePath = data.image.startsWith('photography/') ? data.image : `photography/${data.image}`;
                            fields.innerHTML += `
                                <div class="field-group span-2">
                                    <label>Aktualne zdjęcie</label>
                                    <img src="/${htmlEscape(imagePath)}" style="max-width:100%;max-height:200px;border-radius:8px;">
                                </div>
                            `;
                        }
                    }
                })
                .catch(error => {
                    console.error('Error loading item:', error);
                });
        }

        function deleteItem(id, type) {
            if (confirm(`Czy na pewno chcesz usunąć ten ${getTypeLabel(type)}?`)) {
                fetch(`/delete?type=${type}&id=${id}`, { method: 'POST' })
                    .then(response => {
                        if (response.ok) {
                            loadManageContent(currentManageType);
                        }
                    })
                    .catch(error => {
                        console.error('Error deleting item:', error);
                    });
            }
        }

        function closeModal() {
            document.getElementById('edit-modal').classList.remove('active');
        }

        function getTypeLabel(type) {
            const labels = { post: 'wpis', project: 'projekt', photo: 'fotografię' };
            return labels[type] || type;
        }

        function htmlEscape(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Close modal on overlay click
        document.getElementById('edit-modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        // Close modal on Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });

        // ==========================================
        // INICJALIZACJA
        // ==========================================
        
        // Załaduj początkowe treści do zarządzania (domyślnie wpisy)
        loadManageContent('posts');
    </script>
</body>
</html>"""


class RequestHandler(BaseHTTPRequestHandler):
    def send_html(self, status_html="", manage_html="", content_type="post"):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        
        if not manage_html:
            if content_type == "post":
                items = read_json(POSTS_JSON)
            elif content_type == "project":
                items = read_json(PROJECTS_JSON)
            else:
                items = read_json(PHOTOS_JSON)
            manage_html = render_manage_section(items, content_type)
        
        page = HTML_TEMPLATE.replace("{{STATUS_PLACEHOLDER}}", status_html)
        page = page.replace("{{MANAGE_CONTENT}}", manage_html)
        self.wfile.write(page.encode("utf-8"))

    def do_GET(self):
        # Manage endpoint
        if self.path.startswith("/manage"):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            content_type = params.get("type", ["posts"])[0]
            
            if content_type == "posts":
                items = read_json(POSTS_JSON)
                item_type = "post"
            elif content_type == "projects":
                items = read_json(PROJECTS_JSON)
                item_type = "project"
            elif content_type == "photos":
                items = read_json(PHOTOS_JSON)
                item_type = "photo"
            else:
                items = []
                item_type = "post"
            
            html = render_manage_section(items, item_type)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))
            return
        
        # Get item for edit
        if self.path.startswith("/get_item"):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            item_type = params.get("type", ["post"])[0]
            item_id = int(params.get("id", [0])[0])
            
            if item_type == "post":
                items = read_json(POSTS_JSON)
            elif item_type == "project":
                items = read_json(PROJECTS_JSON)
            elif item_type == "photo":
                items = read_json(PHOTOS_JSON)
            else:
                items = []
            
            item = next((i for i in items if i.get("id") == item_id), {})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(item).encode("utf-8"))
            return
        
        # Serve static files (images)
        if self.path.startswith("/photography/") or self.path.startswith("/projects/banners/"):
            file_path = os.path.join(PROJECT_DIR, self.path[1:])
            if os.path.exists(file_path) and os.path.isfile(file_path):
                self.send_response(200)
                ext = os.path.splitext(file_path)[1].lower()
                if ext in ['.jpg', '.jpeg']:
                    self.send_header("Content-Type", "image/jpeg")
                elif ext == '.png':
                    self.send_header("Content-Type", "image/png")
                elif ext == '.gif':
                    self.send_header("Content-Type", "image/gif")
                elif ext == '.webp':
                    self.send_header("Content-Type", "image/webp")
                else:
                    self.send_header("Content-Type", "application/octet-stream")
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "File not found")
                return
        
        # Strona główna - pokaż zarządzanie wpisami
        posts = read_json(POSTS_JSON)
        manage_html = render_manage_section(posts, "post")
        self.send_html("", manage_html, "post")

    def do_POST(self):
        if self.path == "/add":
            self.handle_add()
        elif self.path == "/edit":
            self.handle_edit()
        elif self.path.startswith("/delete"):
            self.handle_delete()
        else:
            self.send_error(404)

    def handle_add(self):
        fields, files = parse_form(self)
        content_type = fields.get("content_type", "post")

        try:
            if content_type == "post":
                message = self.add_post(fields)
                items = read_json(POSTS_JSON)
                item_type = "post"
            elif content_type == "project":
                message = self.add_project(fields, files)
                items = read_json(PROJECTS_JSON)
                item_type = "project"
            elif content_type == "photo":
                message = self.add_photo(fields, files)
                items = read_json(PHOTOS_JSON)
                item_type = "photo"
            else:
                raise ValueError("Nieznany typ treści.")
            
            manage_html = render_manage_section(items, item_type)
            self.send_html(status_box("success", message), manage_html, item_type)
        except Exception as error:
            self.send_html(status_box("error", str(error)))

    def handle_edit(self):
        fields, files = parse_form(self)
        content_type = fields.get("content_type", "post")
        item_id = int(fields.get("item_id", 0))

        try:
            if content_type == "post":
                message = self.edit_post(fields, item_id)
                items = read_json(POSTS_JSON)
                item_type = "post"
            elif content_type == "project":
                message = self.edit_project(fields, files, item_id)
                items = read_json(PROJECTS_JSON)
                item_type = "project"
            elif content_type == "photo":
                message = self.edit_photo(fields, files, item_id)
                items = read_json(PHOTOS_JSON)
                item_type = "photo"
            else:
                raise ValueError("Nieznany typ treści.")
            
            manage_html = render_manage_section(items, item_type)
            self.send_html(status_box("success", message), manage_html, item_type)
        except Exception as error:
            self.send_html(status_box("error", str(error)))

    def handle_delete(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        item_type = params.get("type", ["post"])[0]
        item_id = int(params.get("id", [0])[0])
        
        try:
            if item_type == "post":
                items = read_json(POSTS_JSON)
                items = [i for i in items if i.get("id") != item_id]
                write_json(POSTS_JSON, items)
                message = "Wpis został usunięty."
            elif item_type == "project":
                items = read_json(PROJECTS_JSON)
                item = next((i for i in items if i.get("id") == item_id), {})
                if item.get("banner"):
                    delete_file(item["banner"])
                items = [i for i in items if i.get("id") != item_id]
                write_json(PROJECTS_JSON, items)
                message = "Projekt został usunięty."
            elif item_type == "photo":
                items = read_json(PHOTOS_JSON)
                item = next((i for i in items if i.get("id") == item_id), {})
                if item.get("image"):
                    delete_file(item["image"])
                items = [i for i in items if i.get("id") != item_id]
                write_json(PHOTOS_JSON, items)
                message = "Fotografia została usunięta."
            else:
                raise ValueError("Nieznany typ treści.")
            
            manage_html = render_manage_section(items, item_type)
            self.send_html(status_box("success", message), manage_html, item_type)
        except Exception as error:
            self.send_html(status_box("error", str(error)))

    def add_post(self, fields):
        title = fields.get("title", "")
        content = fields.get("content", "")
        if not title or not content:
            raise ValueError("Uzupełnij tytuł i treść wpisu.")

        posts = read_json(POSTS_JSON)
        item_id = next_id(posts)
        posts.insert(0, {
            "id": item_id,
            "title": title,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "content": content
        })
        write_json(POSTS_JSON, posts)
        return f'Dodano wpis "{title}".'

    def edit_post(self, fields, item_id):
        title = fields.get("title", "")
        content = fields.get("content", "")
        if not title or not content:
            raise ValueError("Uzupełnij tytuł i treść wpisu.")

        posts = read_json(POSTS_JSON)
        for item in posts:
            if item.get("id") == item_id:
                item["title"] = title
                item["content"] = content
                break
        write_json(POSTS_JSON, posts)
        return f'Zaktualizowano wpis "{title}".'

    def add_project(self, fields, files):
        title = fields.get("title", "")
        description = fields.get("description", "")
        url = fields.get("url", "")
        status = fields.get("status", "Operacyjny")
        if not title or not description or not url:
            raise ValueError("Uzupełnij nazwę, opis i link projektu.")
        if "banner" not in files:
            raise ValueError("Dodaj plik bannera projektu.")

        projects = read_json(PROJECTS_JSON)
        item_id = next_id(projects)
        banner_path = save_upload(files["banner"], PROJECT_BANNERS_DIR, title)
        projects.insert(0, {
            "id": item_id,
            "title": title,
            "description": description,
            "banner": banner_path,
            "url": url,
            "status": status
        })
        write_json(PROJECTS_JSON, projects)
        return f'Dodano projekt "{title}".'

    def edit_project(self, fields, files, item_id):
        title = fields.get("title", "")
        description = fields.get("description", "")
        url = fields.get("url", "")
        status = fields.get("status", "Operacyjny")
        if not title or not description or not url:
            raise ValueError("Uzupełnij nazwę, opis i link projektu.")

        projects = read_json(PROJECTS_JSON)
        for item in projects:
            if item.get("id") == item_id:
                if "banner" in files and files["banner"][0]:
                    if item.get("banner"):
                        delete_file(item["banner"])
                    banner_path = save_upload(files["banner"], PROJECT_BANNERS_DIR, title)
                    item["banner"] = banner_path
                
                item["title"] = title
                item["description"] = description
                item["url"] = url
                item["status"] = status
                break
        write_json(PROJECTS_JSON, projects)
        return f'Zaktualizowano projekt "{title}".'

    def add_photo(self, fields, files):
        title = fields.get("title", "")
        location = fields.get("location", "")
        if not title or not location:
            raise ValueError("Uzupełnij tytuł i lokalizację fotografii.")
        if "photo" not in files:
            raise ValueError("Dodaj plik fotografii.")

        photos = read_json(PHOTOS_JSON)
        item_id = next_id(photos)
        image_path = save_upload(files["photo"], PHOTOGRAPHY_DIR, title)
        photos.insert(0, {
            "id": item_id,
            "title": title,
            "location": location,
            "image": image_path,
            "alt": title
        })
        write_json(PHOTOS_JSON, photos)
        return f'Dodano fotografię "{title}".'

    def edit_photo(self, fields, files, item_id):
        title = fields.get("title", "")
        location = fields.get("location", "")
        if not title or not location:
            raise ValueError("Uzupełnij tytuł i lokalizację fotografii.")

        photos = read_json(PHOTOS_JSON)
        for item in photos:
            if item.get("id") == item_id:
                if "photo" in files and files["photo"][0]:
                    if item.get("image"):
                        delete_file(item["image"])
                    image_path = save_upload(files["photo"], PHOTOGRAPHY_DIR, title)
                    item["image"] = image_path
                    item["alt"] = title
                
                item["title"] = title
                item["location"] = location
                break
        write_json(PHOTOS_JSON, photos)
        return f'Zaktualizowano fotografię "{title}".'


if __name__ == "__main__":
    # Tworzenie niezbędnych katalogów
    os.makedirs(PROJECT_BANNERS_DIR, exist_ok=True)
    os.makedirs(PHOTOGRAPHY_DIR, exist_ok=True)
    
    print("=" * 50)
    print("🚀 KREATOR TREŚCI NOZER")
    print("=" * 50)
    print(f"📁 Katalog projektu: {PROJECT_DIR}")
    print(f"📁 Katalog banerów: {PROJECT_BANNERS_DIR}")
    print(f"📁 Katalog zdjęć: {PHOTOGRAPHY_DIR}")
    print("=" * 50)
    print("🌐 Serwer uruchomiony na: http://localhost:8080")
    print("⌨️  Ctrl+C aby zatrzymać")
    print("=" * 50)
    
    server = HTTPServer(("localhost", 8080), RequestHandler)
    server.serve_forever()