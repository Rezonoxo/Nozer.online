from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
from datetime import datetime
import urllib.parse

FOLDER_PROJEKTU = os.path.dirname(os.path.abspath(__file__))
SCIEZKA_JSON = os.path.join(FOLDER_PROJEKTU, "posts.json")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kreator Wpisów</title>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Parser Markdown -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

    <style>
        :root {
            --bg-color: #0c0d0e;
            --card-bg: #16171a;
            --input-bg: #1e1f23;
            --border-color: rgba(255, 255, 255, 0.08);
            --text-main: #f4f4f5;
            --text-muted: #8e8e93;
            --accent-green: #10b981;
            --accent-green-bg: rgba(16, 185, 129, 0.15);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem 1rem;
        }

        .main-wrapper {
            width: 100%;
            max-width: 1100px;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        /* NAGŁÓWEK W STYLU TWOJEGO SCREENA */
        .top-nav {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 99px;
            padding: 0.75rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 700;
            font-size: 1.05rem;
        }

        .brand i { color: var(--accent-green); }

        /* KARTA EDYCYJNA */
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
        }

        .card-header h1 {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 0.2rem;
        }

        .card-header p {
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .status-msg {
            background: var(--accent-green-bg);
            border: 1px solid var(--accent-green);
            color: var(--accent-green);
            padding: 0.8rem 1.2rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            font-weight: 600;
        }

        .field-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        label {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        input[type="text"] {
            width: 100%;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            color: var(--text-main);
            font-family: inherit;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s;
        }

        input[type="text"]:focus {
            border-color: var(--accent-green);
        }

        /* PRZEŁĄCZNIK WIDOKU (EDIT / SPLIT / PREVIEW) */
        .workspace-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .view-toggle {
            display: flex;
            background: var(--input-bg);
            padding: 3px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            gap: 2px;
        }

        .toggle-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .toggle-btn.active {
            background: var(--card-bg);
            color: var(--text-main);
        }

        /* PASEK NARZĘDZI MARKDOWN */
        .toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            background: var(--input-bg);
            padding: 6px 10px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }

        .tool-btn {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 5px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s;
        }

        .tool-btn:hover {
            background: var(--border-color);
            color: var(--accent-green);
        }

        /* OBSZAR EDYCJI I PODGLĄDU */
        .workspace-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            min-height: 400px;
        }

        .workspace-grid.mode-edit { grid-template-columns: 1fr; }
        .workspace-grid.mode-edit .preview-container { display: none; }

        .workspace-grid.mode-preview { grid-template-columns: 1fr; }
        .workspace-grid.mode-preview .editor-container { display: none; }

        textarea {
            width: 100%;
            height: 100%;
            min-height: 380px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            color: var(--text-main);
            font-family: 'Fira Code', monospace;
            font-size: 0.95rem;
            line-height: 1.6;
            resize: vertical;
            outline: none;
            transition: border-color 0.2s;
        }

        textarea:focus {
            border-color: var(--accent-green);
        }

        /* PODGLĄD RENDEROWANEGO MARKDOWNU */
        .preview-box {
            height: 100%;
            min-height: 380px;
            padding: 16px;
            background: var(--input-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow-y: auto;
            line-height: 1.6;
        }

        .preview-box h1, .preview-box h2, .preview-box h3 { margin-top: 1rem; margin-bottom: 0.5rem; color: #fff; }
        .preview-box p { margin-bottom: 0.8rem; color: #d1d1d6; }
        .preview-box a { color: var(--accent-green); text-decoration: underline; }
        .preview-box img { max-width: 100%; border-radius: 8px; margin: 0.8rem 0; border: 1px solid var(--border-color); }
        .preview-box code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .preview-box pre { background: #000; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.8rem 0; border: 1px solid var(--border-color); }
        .preview-box blockquote { border-left: 3px solid var(--accent-green); padding-left: 0.8rem; color: var(--text-muted); font-style: italic; }
        .preview-box ul, .preview-box ol { margin-left: 1.2rem; margin-bottom: 0.8rem; }

        /* PRZYCISK OPUBLIKUJ */
        .btn-submit {
            width: 100%;
            background: #f4f4f5;
            color: #000;
            border: none;
            padding: 14px;
            border-radius: 99px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: opacity 0.2s, transform 0.1s;
            margin-top: 0.5rem;
        }

        .btn-submit:hover { opacity: 0.9; transform: translateY(-1px); }
    </style>
</head>
<body>

    <div class="main-wrapper">
        <!-- TOP BAR -->
        <div class="top-nav">
            <div class="brand">
                <i class="fas fa-feather-alt"></i>
                <span>Kreator Wpisów</span>
            </div>
            <i class="far fa-moon" style="color: var(--text-muted); cursor: pointer;"></i>
        </div>

        <!-- FORMULARZ -->
        <form action="/add" method="POST" class="card">
            <div class="card-header">
                <h1>Nowy wpis</h1>
                <p>Wypełnij pola poniżej, aby dodać nową notatkę do pliku posts.json.</p>
            </div>

            {{STATUS_PLACEHOLDER}}

            <div class="field-group">
                <label>Tytuł wpisu</label>
                <input type="text" id="post-title" name="title" placeholder="Tytuł notatki..." required>
            </div>

            <div class="field-group">
                <div class="workspace-header">
                    <label>Treść wpisu (Markdown)</label>
                    <div class="view-toggle">
                        <button type="button" class="toggle-btn" onclick="setMode('edit')"><i class="fas fa-code"></i> Kod</button>
                        <button type="button" class="toggle-btn active" onclick="setMode('split')"><i class="fas fa-columns"></i> Dzielony</button>
                        <button type="button" class="toggle-btn" onclick="setMode('preview')"><i class="fas fa-eye"></i> Podgląd</button>
                    </div>
                </div>

                <div class="toolbar">
                    <button type="button" class="tool-btn" onclick="insertMD('# ')"><b>H1</b></button>
                    <button type="button" class="tool-btn" onclick="insertMD('## ')"><b>H2</b></button>
                    <button type="button" class="tool-btn" onclick="wrapMD('**', '**')"><i class="fas fa-bold"></i></button>
                    <button type="button" class="tool-btn" onclick="wrapMD('*', '*')"><i class="fas fa-italic"></i></button>
                    <button type="button" class="tool-btn" onclick="insertMD('- ')"><i class="fas fa-list-ul"></i></button>
                    <button type="button" class="tool-btn" onclick="insertMD('> ')"><i class="fas fa-quote-right"></i></button>
                    <button type="button" class="tool-btn" onclick="wrapMD('```\\n', '\\n```')"><i class="fas fa-code"></i></button>
                    <button type="button" class="tool-btn" onclick="insertMD('[Tytuł](https://)')"><i class="fas fa-link"></i></button>
                    <button type="button" class="tool-btn" onclick="insertMD('![Opis](https://)')"><i class="fas fa-image"></i></button>
                </div>

                <div class="workspace-grid mode-split" id="workspace">
                    <div class="editor-container">
                        <textarea id="post-content" name="content" placeholder="Napisz tutaj coś ciekawego w Markdownie..." required></textarea>
                    </div>
                    <div class="preview-container">
                        <div class="preview-box" id="preview-box"></div>
                    </div>
                </div>
            </div>

            <button type="submit" class="btn-submit">
                <i class="fas fa-paper-plane"></i> Opublikuj wpis
            </button>
        </form>
    </div>

    <script>
        const contentInput = document.getElementById('post-content');
        const previewBox = document.getElementById('preview-box');
        const workspace = document.getElementById('workspace');

        function updatePreview() {
            previewBox.innerHTML = marked.parse(contentInput.value || '<span style="color: var(--text-muted); font-style: italic;">Podgląd pojawi się tutaj...</span>');
        }

        function setMode(mode) {
            workspace.className = 'workspace-grid mode-' + mode;
            document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            event.currentTarget.classList.add('active');
        }

        function insertMD(prefix) {
            const start = contentInput.selectionStart;
            const end = contentInput.selectionEnd;
            const text = contentInput.value;
            contentInput.value = text.substring(0, start) + prefix + text.substring(end);
            contentInput.focus();
            contentInput.selectionStart = start + prefix.length;
            contentInput.selectionEnd = start + prefix.length;
            updatePreview();
        }

        function wrapMD(prefix, suffix) {
            const start = contentInput.selectionStart;
            const end = contentInput.selectionEnd;
            const text = contentInput.value;
            const selectedText = text.substring(start, end) || 'tekst';
            
            contentInput.value = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
            contentInput.focus();
            contentInput.selectionStart = start + prefix.length;
            contentInput.selectionEnd = start + prefix.length + selectedText.length;
            updatePreview();
        }

        // Obsługa wcięcia TAB w textarea
        contentInput.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                insertMD('    ');
            }
        });

        contentInput.addEventListener('input', updatePreview);
        updatePreview();
    </script>
</body>
</html>"""

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        html = HTML_TEMPLATE.replace("{{STATUS_PLACEHOLDER}}", "")
        self.wfile.write(html.encode('utf-8'))

    def do_POST(self):
        if self.path == '/add':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            parsed_data = urllib.parse.parse_qs(body)

            title = parsed_data.get('title', [''])[0].strip()
            content = parsed_data.get('content', [''])[0].strip()

            if title and content:
                wpisy = []
                if os.path.exists(SCIEZKA_JSON):
                    try:
                        with open(SCIEZKA_JSON, "r", encoding="utf-8") as f:
                            wpisy = json.load(f)
                    except Exception:
                        wpisy = []

                nowe_id = max([w.get("id", 0) for w in wpisy], default=0) + 1
                dzisiaj = datetime.now().strftime("%Y-%m-%d")

                nowy_wpis = {
                    "id": nowe_id,
                    "title": title,
                    "date": dzisiaj,
                    "content": content
                }

                wpisy.insert(0, nowy_wpis)

                with open(SCIEZKA_JSON, "w", encoding="utf-8") as f:
                    json.dump(wpisy, f, ensure_ascii=False, indent=4)

                status_html = f"""
                <div class="status-msg">
                    <i class="fas fa-check-circle"></i>
                    Pomyślnie dodano wpis "{title}" (ID: {nowe_id}) do posts.json!
                </div>
                """
                
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                html = HTML_TEMPLATE.replace("{{STATUS_PLACEHOLDER}}", status_html)
                self.wfile.write(html.encode('utf-8'))

if __name__ == "__main__":
    server = HTTPServer(('localhost', 8080), RequestHandler)
    print("Serwer uruchomiony na: http://localhost:8080")
    server.serve_forever()