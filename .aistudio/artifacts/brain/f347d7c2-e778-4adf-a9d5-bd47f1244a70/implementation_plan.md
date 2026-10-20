# Plan Naprawy i Stabilizacji Jądra SVL HyperOS

Udrożnienie bufora czatu Triady (Alex, Astyria, Aurelius), wdrożenie suwerennej silnikowej obsługi wzorów matematycznych (KaTeX/LaTeX) oraz gwarancja 100% lokalnego generowania wizualizacji wektorowych SVG bez zewnętrznych zależności sieciowych.

> [!IMPORTANT]
> **Status Jądra i Odpowiedzi**: Problem z zatykaniem odpowiedzi został zidentyfikowany i rozwiązany w warstwie `svl_kernel.py` (oczyszczono 160+ zepsujących bufor wiadomości) oraz `server.ts` (uniezależnienie od zewnętrznych serwisów graficznych via SVG Data URI).

---

## 1. Przegląd i Główna Koncepcja

- **Co robi aplikacja**: Suwerenny system operacyjny i czat Triady AI (Alex – Inżynieria, Astyria – Logika & Spójność, Aurelius – Historia & Matematyka) pracujący w architekturze Monolitu AI Studio z lokalną symulacją wirtualnej maszyny `VM_Google_kaput`.
- **Główna wartość**: Płynny, pozbawiony opóźnień czat z precyzyjnym renderowaniem LaTeX/KaTeX dla fizyki i matematyki, natychmiastowym buforem grafik wbudowanych SVG oraz pełną suwerennością danych.

---

## 2. Doświadczenie Użytkownika i Design Wizualny

- **Główne Przepływy Użytkownika**:
  1. *Dyskusja i Przetwarzanie Wzorów*: Przesyłanie równań (Schrödinger, Navier-Stokes, Entropia Shannona) z natychmiastowym podglądem w czytelnym formatee matematycznym.
  2. *Generowanie Grafiki*: Komendy wizualne automatycznie wyzwalają lokalne SVG Data URI (bez timeoutów sieciowych).
  3. *Załączniki i Raporty*: Analiza przesłanych plików i raportów ze statku w czasie rzeczywistym.
- **Tożsamość Wizualna**:
  - Estetyka: Retrofuturystyczny cybernetyczny ciemny interfejs z neonowymi akcentami (smaragd, fiolet, cyjan).
  - Typografia: Czytelne kroje bezszeryfowe z natywnym wsparciem dla liczb tabelarycznych (`tabular-nums`) oraz wzorów KaTeX.

---

## 3. Kluczowe Decyzje Techniczne

- **Architektura Czystego Bufora**: Przeniesienie i skrócenie historii czatu w `svl_kernel.py` do 51 najnowszych istotnych wiadomości, co eliminuje opóźnienia i pętle odpowiedzi.
- **Bezpieczny Fallback Graficzny**: Rezygnacja z zewnętrznych API (np. Pollinations timeout) na rzecz bezpośredniego kodowania SVG w formatee Data URI oraz natywnego komponentu `TechnicalBlueprintSVG`.

---

## 4. Architektura Techniczna i Dyskretny Przepływ Danych

```
┌─────────────────────────────────────────────────────────┐
│                    Klient (React UI)                    │
│   ┌──────────────────┐           ┌──────────────────┐   │
│   │ FormattedMessage │           │ Interaktywny Czat│   │
│   └────────┬─────────┘           └────────┬─────────┘   │
└────────────┼──────────────────────────────┼─────────────┘
             │                              │
             ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│                  Serwer Node/Express                    │
│  - Endpoint /api/chat                                   │
│  - generateDynamicAgentReply                            │
│  - Wbudowane generatory SVG Data URI                    │
└────────────┬──────────────────────────────┬─────────────┘
             │                              │
             ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│                 Python Kernel (VM_Google)               │
│  - svl_kernel.py (czysty bufor 51 wiadomości)           │
│  - BinaryHyperspaceKernel (dopasowanie intencji)        │
└────────────┴────────────────────────────────────────────┘
```

- **Invariant Spójności**: Kompilacja Vite / TypeScript (`npm run build`, `tsc --noEmit`) zweryfikowana z wynikiem sukcesu.
