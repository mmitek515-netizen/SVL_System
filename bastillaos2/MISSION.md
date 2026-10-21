# Misja BUILD_BEST_OS — BastillaOS 2

Cel: zupełnie nowy system operacyjny, budowany od podstaw przez Triadę.
To nie jest łatka do BastillaOS 1 (`bastillaos/`) — ta wersja służy tylko
jako baza do odczytu i źródło sprawdzonych rozwiązań.

Pracują autonomicznie: **Alex** planuje, **Astyria** buduje, **Aurelius**
weryfikuje. Cykl trafia do git tylko po „WERDYKT: OK” oraz przejściu
`bash bastillaos2/check.sh` i `npm test`.

## Postęp: ~30%

Uwaga: obraz ISO nie został jeszcze zbudowany ani uruchomiony — to pierwszy
prawdziwy sprawdzian (GitHub Actions → Build BastillaOS 2 ISO).

| Faza | Stan | % |
| --- | --- | --- |
| 1. Architektura | gotowa (sekcja niżej) | 100 |
| 2. Budowanie ISO | `build.sh`, `builder/Dockerfile`, `config/auto/config`, CI — czeka na pierwsze budowanie | 80 |
| 3. Warstwa systemowa | UFW DROP, AppArmor, sysctl, unattended-upgrades, Btrfs + snapper + grub-btrfs | 50 |
| 4. Triada natywnie | usługi `bastilla-alex/astyria/aurelius` + `triadctl`; brak integracji z SVL | 40 |
| 5. Pulpit i wygląd | wybrane pakiety Plasma 6; brak motywu, tapet, układu | 10 |
| 6. Instalator | Calamares z domyślnym Btrfs; brak brandingu Calamares | 20 |
| 7. Testy i CI | `check.sh` (składnia, konfiguracja, 10 testów Triady), workflow CI | 50 |

## Architektura

- **Podstawa:** Debian 13 Trixie amd64, jądro `linux-image-amd64`, systemd.
- **Obraz:** live-build, hybrydowe ISO (UEFI + BIOS: `grub-efi`, `syslinux`),
  `--apt-recommends false` dla mniejszego systemu.
- **Instalator:** Calamares (zamiast debian-installer), domyślnie Btrfs.
- **Odporność:** Btrfs + snapper (snapshot przed każdą zmianą pakietów przez hook
  snappera) + grub-btrfs (start ze snapshotu z menu GRUB). Astyria robi
  codzienny snapshot i tworzy konfigurację snappera przy pierwszym starcie.
- **Triada:** `/usr/lib/bastilla/triad/triad.py` (Python, bez zależności),
  trzy usługi oneshot z timerami, raporty JSON w `/var/lib/bastilla/triad/`,
  CLI `triadctl`. Samonaprawa Astyrii dotyczy tylko usług `bastilla-*`.
- **Bezpieczeństwo:** UFW z polityką DROP, AppArmor, utwardzenie sysctl,
  automatyczne poprawki bezpieczeństwa; Aurelius codziennie to audytuje.
- **Pulpit:** `kde-plasma-desktop` (Plasma 6), SDDM, PipeWire.

Struktura:

```
bastillaos2/
  build.sh, check.sh, builder/Dockerfile
  config/auto/config                 # lb config
  config/package-lists/*.list.chroot # base, desktop
  config/hooks/live/*.hook.chroot    # konfiguracja w chroot
  config/includes.chroot/            # pliki systemu (Triada, sysctl, release)
  tests/                             # testy Triady (unittest)
```

## Następny krok

Faza 2: zbudować pierwsze ISO w GitHub Actions i naprawić błędy budowania
(nazwy pakietów, usługa `grub-btrfsd`, konfiguracja Calamares).

## Dziennik

- 2026-10-21 · Alex: architektura BastillaOS 2 (Debian 13, Calamares, Btrfs + snapshoty, Plasma 6 minimal, Triada jako usługi systemd).
- 2026-10-21 · Astyria: system budowania ISO, warstwa bezpieczeństwa, usługi Triady + `triadctl`, workflow CI.
- 2026-10-21 · Aurelius: `check.sh` + 10 testów Triady — OK; `triadctl` sprawdzony na prawdziwym Linuksie.
