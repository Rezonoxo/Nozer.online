import json
import os
from datetime import datetime

# Automatycznie pobiera folder, w którym znajduje się TEN SKRYPT:
FOLDER_PROJEKTU = os.path.dirname(os.path.abspath(__file__))
SCIEZKA_JSON = os.path.join(FOLDER_PROJEKTU, "posts.json")


def zapisz_do_json():
    print(f"--- FOLDER ROBOCZY: {FOLDER_PROJEKTU} ---")
    print(f"--- CEL ZAPISU: {SCIEZKA_JSON} ---\n")

    tytul = input("Podaj tytuł wpisu: ").strip()

    print("\nWpisz treść (naciśnij Enter dwa razy w pustej linii, aby zakończyć):")
    linie = []
    while True:
        linia = input()
        if linia == "" and (len(linie) > 0 and linie[-1] == ""):
            break
        linie.append(linia)

    tresc = "\n".join(linie).strip()

    if not tytul or not tresc:
        print("\n[!] Tytuł ani treść nie mogą być puste!")
        return

    wpisy = []

    # 1. Odczyt pliku z obsługą błędów
    if os.path.exists(SCIEZKA_JSON):
        try:
            with open(SCIEZKA_JSON, "r", encoding="utf-8") as f:
                wpisy = json.load(f)
            print(f"[OK] Wczytano obecnych wpisów: {len(wpisy)}")
        except Exception as e:
            print(
                f"[!] Błąd podczas odczytu posts.json ({e}). Tworzę nową listę."
            )
            wpisy = []

    # 2. Przygotowanie nowego wpisu
    nowe_id = max([w.get("id", 0) for w in wpisy], default=0) + 1
    dzisiaj = datetime.now().strftime("%Y-%m-%d")

    nowy_wpis = {
        "id": nowe_id,
        "title": tytul,
        "date": dzisiaj,
        "content": tresc,
    }

    wpisy.insert(0, nowy_wpis)

    # 3. Zapis do pliku
    try:
        with open(SCIEZKA_JSON, "w", encoding="utf-8") as f:
            json.dump(wpisy, f, ensure_ascii=False, indent=4)
        print(f"\n[SUKCES] Zapisano wpis ID {nowe_id} do pliku!")
        print(f"Łączna liczba wpisów w posts.json: {len(wpisy)}")
    except Exception as e:
        print(f"\n[BŁĄD ZAPISU] Nie udało się zapisać pliku: {e}")


if __name__ == "__main__":
    zapisz_do_json()