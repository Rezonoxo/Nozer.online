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


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kreator tresci | Nozer</title>
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
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-weight: 800;
        }

        .brand i { color: var(--accent); }

        .type-switcher {
            display: flex;
            gap: 6px;
            padding: 4px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: rgba(255,255,255,0.03);
            flex-wrap: wrap;
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
        textarea {
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
        textarea:focus {
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

        @media (max-width: 760px) {
            body { padding: 1rem; }
            .top-nav {
                align-items: stretch;
                border-radius: 20px;
                flex-direction: column;
            }
            .type-switcher,
            .type-btn { width: 100%; }
            .type-btn { justify-content: center; }
            .field-grid,
            .markdown-layout { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="main-wrapper">
        <div class="top-nav">
            <div class="brand">
                <i class="fas fa-wand-magic-sparkles"></i>
                <span>Kreator tresci</span>
            </div>
            <div class="type-switcher" aria-label="Typ tresci">
                <button class="type-btn active" type="button" data-panel="post"><i class="fas fa-pen-nib"></i> Wpis</button>
                <button class="type-btn" type="button" data-panel="project"><i class="fas fa-folder-open"></i> Projekt</button>
                <button class="type-btn" type="button" data-panel="photo"><i class="fas fa-camera"></i> Fotografia</button>
            </div>
        </div>

        <section class="card">
            <div class="card-header">
                <h1>Dodaj nowa pozycje</h1>
                <p>Wybierz typ tresci, uzupelnij dane i wyslij plik. Kreator dopisze rekord do odpowiedniego pliku JSON.</p>
            </div>

            {{STATUS_PLACEHOLDER}}

            <form action="/add" method="POST" enctype="multipart/form-data" class="form-panel active" data-form-panel="post">
                <input type="hidden" name="content_type" value="post">
                <div class="field-group">
                    <label>Tytul wpisu</label>
                    <input type="text" name="title" placeholder="Tytul notatki..." required>
                </div>
                <div class="markdown-layout">
                    <div class="field-group">
                        <label>Tresc wpisu Markdown</label>
                        <textarea id="post-content" name="content" placeholder="Napisz tresc wpisu..." required></textarea>
                    </div>
                    <div class="field-group">
                        <label>Podglad</label>
                        <div class="preview-box" id="preview-box"></div>
                    </div>
                </div>
                <button type="submit" class="btn-submit"><i class="fas fa-paper-plane"></i> Opublikuj wpis</button>
            </form>

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
                        <textarea name="description" placeholder="Krotki opis projektu..." required></textarea>
                    </div>
                </div>
                <button type="submit" class="btn-submit"><i class="fas fa-upload"></i> Dodaj projekt</button>
            </form>

            <form action="/add" method="POST" enctype="multipart/form-data" class="form-panel" data-form-panel="photo">
                <input type="hidden" name="content_type" value="photo">
                <div class="field-grid">
                    <div class="field-group">
                        <label>Tytul zdjecia</label>
                        <input type="text" name="title" placeholder="Tytul fotografii..." required>
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
                <button type="submit" class="btn-submit"><i class="fas fa-upload"></i> Dodaj fotografie</button>
            </form>
        </section>
    </div>

    <script>
        const buttons = document.querySelectorAll('.type-btn');
        const panels = document.querySelectorAll('[data-form-panel]');
        const contentInput = document.getElementById('post-content');
        const previewBox = document.getElementById('preview-box');

        function setPanel(panelName) {
            buttons.forEach(button => button.classList.toggle('active', button.dataset.panel === panelName));
            panels.forEach(panel => panel.classList.toggle('active', panel.dataset.formPanel === panelName));
        }

        function updatePreview() {
            const emptyText = '<span style="color: var(--muted); font-style: italic;">Podglad pojawi sie tutaj...</span>';
            previewBox.innerHTML = marked.parse(contentInput.value || emptyText);
        }

        buttons.forEach(button => {
            button.addEventListener('click', () => setPanel(button.dataset.panel));
        });

        contentInput.addEventListener('input', updatePreview);
        updatePreview();
    </script>
</body>
</html>"""


class RequestHandler(BaseHTTPRequestHandler):
    def send_html(self, status_html=""):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        page = HTML_TEMPLATE.replace("{{STATUS_PLACEHOLDER}}", status_html)
        self.wfile.write(page.encode("utf-8"))

    def do_GET(self):
        self.send_html()

    def do_POST(self):
        if self.path != "/add":
            self.send_error(404)
            return

        fields, files = parse_form(self)
        content_type = fields.get("content_type", "post")

        try:
            if content_type == "post":
                message = self.add_post(fields)
            elif content_type == "project":
                message = self.add_project(fields, files)
            elif content_type == "photo":
                message = self.add_photo(fields, files)
            else:
                raise ValueError("Nieznany typ tresci.")
            self.send_html(status_box("success", message))
        except Exception as error:
            self.send_html(status_box("error", str(error)))

    def add_post(self, fields):
        title = fields.get("title", "")
        content = fields.get("content", "")
        if not title or not content:
            raise ValueError("Uzupelnij tytul i tresc wpisu.")

        posts = read_json(POSTS_JSON)
        item_id = next_id(posts)
        posts.insert(0, {
            "id": item_id,
            "title": title,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "content": content
        })
        write_json(POSTS_JSON, posts)
        return f'Dodano wpis "{title}" do posts.json.'

    def add_project(self, fields, files):
        title = fields.get("title", "")
        description = fields.get("description", "")
        url = fields.get("url", "")
        status = fields.get("status", "Operacyjny")
        if not title or not description or not url:
            raise ValueError("Uzupelnij nazwe, opis i link projektu.")
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
        return f'Dodano projekt "{title}" do projects.json.'

    def add_photo(self, fields, files):
        title = fields.get("title", "")
        location = fields.get("location", "")
        if not title or not location:
            raise ValueError("Uzupelnij tytul i lokalizacje fotografii.")
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
        return f'Dodano fotografie "{title}" do photos.json.'


if __name__ == "__main__":
    os.makedirs(PROJECT_BANNERS_DIR, exist_ok=True)
    os.makedirs(PHOTOGRAPHY_DIR, exist_ok=True)
    server = HTTPServer(("localhost", 8080), RequestHandler)
    print("Serwer uruchomiony na: http://localhost:8080")
    server.serve_forever()
