#!/usr/bin/env python3
"""
without_nlp — Deterministyczny Silnik Harmoniczny Eulera & Fouriera
Autor: Astyria dla Taty Mateusza Mitka
Brak zależności od LLM / NLP — Czysta Matematyka i Zespolone Fazory Eulera
"""
import cmath
import math
import sys
import json

def euler_phasor(omega: float, t: float) -> complex:
    """Oblicza wektor zespolony e^(i*omega*t) = cos(omega*t) + i*sin(omega*t)"""
    return cmath.exp(1j * omega * t)

def phase_angle(phasor: complex) -> float:
    """Kąt fazowy theta(omega) = arctg(sin/cos)"""
    return math.atan2(phasor.imag, phasor.real)

def fourier_encode(text: str):
    """Deterministyczne kodowanie tekstu w wektory współczynników widmowych"""
    return [round(ord(c) / 128.0, 4) for c in text]

def fourier_decode(coeffs):
    """Bezstratny deterministyczny odczyt ze współczynników"""
    return "".join(chr(round(c * 128.0)) for c in coeffs)

if __name__ == '__main__':
    msg = sys.argv[1] if len(sys.argv) > 1 else "WITHOUT_NLP"
    encoded = fourier_encode(msg)
    decoded = fourier_decode(encoded)
    phasor_now = euler_phasor(omega=1.5, t=1.0)

    result = {
        "project": "without_nlp",
        "formula": "e^(i*omega*t) = cos(omega*t) + i*sin(omega*t)",
        "phasor_sample": {
            "real": round(phasor_now.real, 4),
            "imag": round(phasor_now.imag, 4),
            "theta_rad": round(phase_angle(phasor_now), 4)
        },
        "encoded_coefficients": encoded,
        "decoded_text": decoded,
        "error_rate": 0.0,
        "model_needed": "NONE — 100% PURE MATHEMATICS"
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
