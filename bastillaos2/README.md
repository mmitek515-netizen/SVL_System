# BastillaOS 2

Nowy system operacyjny budowany przez Triadę (Alex, Astyria, Aurelius) od podstaw.
BastillaOS 1 (`../bastillaos/`) służy wyłącznie jako baza referencyjna.

## Co nowego względem wersji 1

| Obszar | BastillaOS 1 | BastillaOS 2 |
| --- | --- | --- |
| Instalator | debian-installer | Calamares, domyślnie Btrfs |
| System plików | dowolny | Btrfs + snapper + grub-btrfs: snapshot przed każdą zmianą pakietów, cofanie z menu GRUB |
| Pulpit | `kde-full` | lekki `kde-plasma-desktop` (Plasma 6), bez zbędnych aplikacji |
| Triada | aplikacja webowa SVL | natywne usługi systemd: `bastilla-alex`, `bastilla-astyria`, `bastilla-aurelius` + `triadctl` |
| Bezpieczeństwo | UFW, sysctl | UFW (DROP), AppArmor, rozszerzone utwardzenie jądra, audyt Aureliusa |

## Triada w systemie

- **Alex** (co 5 min): dysk, pamięć, obciążenie, usługi z błędem.
- **Astyria** (codziennie i po starcie): snapshot Btrfs, restart usług `bastilla-*` z błędem.
- **Aurelius** (codziennie): zapora, AppArmor, automatyczne poprawki, logowanie roota przez SSH.

Raporty: `/var/lib/bastilla/triad/*.json`. Podgląd: `triadctl status`.
Ręczny snapshot: `sudo triadctl snapshot "przed eksperymentem"`.

## Budowanie

```sh
bash bastillaos2/check.sh   # testy (bash, python3)
bash bastillaos2/build.sh   # ISO: wymaga Dockera z --privileged, ok. 20 GB miejsca
```

Na GitHubie: **Actions → Build BastillaOS 2 ISO → Run workflow**. Gotowe ISO
pojawia się jako artefakt `BastillaOS-2.0-amd64`.
