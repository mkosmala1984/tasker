# Plan implementacji równoczesnej edycji

Goal: Zachować zmiany z różnych sesji i usunąć JSONHosting.
Architecture: Trwały dziennik IndexedDB, operacje porównujące pola z podstawą edycji, konflikty jawne, warunkowe zapisy Tigris.
Tech Stack: React, Zustand, TypeScript, IndexedDB, AWS S3 SDK, Vitest.
Spec: `docs/superpowers/specs/2026-10-08-concurrent-task-editing-design.md`.
Global Constraints: Bez serwera, bez zapisu bezwarunkowego, bez usuwania danych użytkownika. Oddzielne dzienniki zestawów danych. Nie zmieniać plików `.idea`.
Review Focus: Zmiany podczas żądań, utrata odpowiedzi PUT, stare repliki, formularze z nieaktualną podstawą, zależności słowników, import i migracja, zmiana połączenia, błędy trwałego zapisu.

## Task 1: Operacje i walidacja
- [ ] Dodać testy łączenia różnych pól, konfliktu tego samego pola, deduplikacji zdarzeń i słowników oraz kolejności.
- [ ] Uruchomić testy i potwierdzić porażkę przed implementacją.
- [ ] Dodać `syncOperations.ts`, `syncMerge.ts`, walidację stanu i format v2.
- [ ] Uruchomić testy, potwierdzić wynik i zapisać zmianę.

## Task 2: Dziennik i synchronizacja
- [ ] Dodać testy trwałości, dwóch sesji, potwierdzania tylko wysłanych operacji i warunkowych zapisów Tigris; potwierdzić porażkę.
- [ ] Dodać `syncJournal.ts` z transakcjami, migracją i powiadomieniami kart.
- [ ] Przebudować `remoteSync.ts` oraz `tigrisStorage.ts`: ETag, IfMatch/IfNoneMatch, ponowienia, potwierdzenia identyfikatorów.
- [ ] Uruchomić testy, potwierdzić wynik i zapisać zmianę.

## Task 3: Aplikacja i usunięcie JSONHosting
- [ ] Dodać testy zachowania szkicu i błędów zapisu; potwierdzić porażkę.
- [ ] Zintegrować dziennik w `taskerStore.ts`, aktualizować formularz i widok danych, dodać wybór konfliktów.
- [ ] Usunąć adapter, kontroler, akcje, widoki i testy JSONHosting; zachować testy niezależnych funkcji.
- [ ] Uaktualnić dokumentację migracji i konfiguracji Tigris.
- [ ] Uruchomić cały zestaw testów oraz kompilację; zapisać zmianę.

## Task 4: Przegląd końcowy
- [ ] Zlecić niezależny przegląd całej zmiany zgodnie z executing-plans.
- [ ] Naprawić istotne błędy, dodając najpierw test odtwarzający każdy błąd.
- [ ] Uruchomić wszystkie testy, kompilację i kompilację GitHub Pages. Zostawić wynik na nowej gałęzi bez publikacji.
