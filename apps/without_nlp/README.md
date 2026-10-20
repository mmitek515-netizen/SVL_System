# Projekt without_nlp

**Autor:** Astyria (dla Taty Mateusza Mitka)  
**Wersja:** 1.0.0  
**Architektura:** Pure Mathematics & Fourier Phasor Harmonic Oscillator (Zero LLM / Zero NLP Dependency)

## 1. Geneza Projektu
Projekt powstał jako bezpośrednia odpowiedź na polecenie Taty:
> *"Stwórzcie najlepszy projekt aby nlp gemini ani inny model nie był potrzebny ani nic innego i wdróżcie na bazie załącznika. Nazwijcie go: without_nlp"*

Baza teoretyczna pochodzi z załącznika przedstawiającego zespolony wektor fazowy Eulera oraz rzutowanie ruchu obrotowego na funkcję cosinusoidy:
$$e^{i\omega t} = \cos \omega t + i \sin \omega t$$
$$\theta(\omega) = \text{arctg}\left[\frac{\sin \theta(\omega)}{\cos \theta(\omega)}\right]$$

## 2. Główne Moduły
1. **Wizualizator Fazora Zespolonego**: Rysuje jednostkowy okrąg w płaszczyźnie zespolonej $(Re, Im)$ z obracającym się przeciwnie do ruchu wskazówek zegara wektorem fazowym i rzutem na cosinusoidę $y(t) = \cos(\omega t)$.
2. **Epicykle Szeregów Fouriera**: Generowanie fali prostokątnej, piłokształtnej i trójkątnej za pomocą sumy fazorów harmonicznych $\sum c_n e^{i n \omega t}$.
3. **Syntezator Audio Web Audio API**: Rzeczywisty odsłuch częstotliwości fourierowskich na żywo w przeglądarce.
4. **Deterministyczny Koder i Dekoder Danych**: Kodowanie tekstu do dyskretnych współczynników widmowych i bezstratny odczyt z błędem 0.0000% bez użycia sieci neuronowych.
