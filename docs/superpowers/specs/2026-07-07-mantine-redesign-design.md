# Tasker - projekt migracji UI na Mantine

Data: 2026-07-07

## Cel

Celem zmiany jest dodanie Mantine jako biblioteki komponentow UI i lekki redesign glownego ekranu "Dzisiaj". Aplikacja ma zachowac obecny przeplyw pracy, logike domenowa, model danych i lokalne przechowywanie w `localStorage`.

Zmiana dotyczy warstwy prezentacji: provider aplikacji, layout, formularze, filtry, karty zadan, stan pusty i komunikaty. Nie obejmuje nowych funkcji produktowych.

## Zakres

W zakresie sa:

- instalacja `@mantine/core` oraz `@mantine/hooks`,
- import stylow Mantine w punkcie wejscia aplikacji,
- opakowanie aplikacji w `MantineProvider`,
- zastapienie wlasnych kontrolek komponentami Mantine tam, gdzie pasuja do obecnych funkcji,
- lekki redesign ekranu "Dzisiaj" z bardziej spojnym ukladem, odstepami, kartami i badge'ami,
- ograniczenie wlasnego CSS do layoutu strony i drobnych dopasowan,
- utrzymanie dostepnych etykiet formularzy i nazw akcji uzywanych przez testy UI,
- uruchomienie testow oraz builda po zmianach.

Poza zakresem sa:

- zmiany w logice powtarzania zadan,
- zmiany w formacie danych `localStorage`,
- backend, synchronizacja, konta uzytkownikow,
- dodawanie statystyk, widoku kalendarza lub nowych ekranow,
- zmiana jezyka interfejsu.

## Architektura UI

`src/main.tsx` bedzie odpowiedzialny za zaladowanie `@mantine/core/styles.css`, obecnego `styles.css` oraz opakowanie `App` w `MantineProvider`.

`src/App.tsx` pozostanie glownym ekranem aplikacji. Zamiast recznie stylowanych elementow uzyje komponentow Mantine takich jak `Container`, `Paper`, `Group`, `Stack`, `Title`, `Text`, `Button` i `Alert`.

Komponenty w `src/components` zostana przepisane na Mantine bez przenoszenia do nich logiki domenowej:

- `TaskFilters` uzyje `SegmentedControl` dla kategorii i `Select` dla osoby,
- `TodayTaskCard` uzyje `Card`, `Badge`, `Group`, `Stack`, `Text` i `Button`,
- `TodayTaskList` uzyje Mantine dla stanu pustego,
- `QuickAddForm` uzyje `TextInput`, `Button`, `Paper` lub `Stack`,
- `TaskForm` uzyje `TextInput`, `NativeSelect`, `NumberInput`, `Button` i ukladu Mantine.

## Zachowanie

Wszystkie obecne przeplywy maja dzialac tak samo:

- dodawanie zadania przez szybki formularz,
- przeniesienie fokusu z przycisku w naglowku do pola nazwy zadania,
- oznaczanie zadania jako wykonane,
- odkladanie zadania na jutro,
- filtrowanie po kategorii i osobie,
- edycja oraz dezaktywacja zadania,
- pokazanie stanu pustego, gdy nie ma zadan na dzisiaj,
- pokazanie ostrzezenia przy problemie z lokalnymi danymi.

Widoczne teksty akcji i etykiet pozostana zgodne z obecnymi testami, z korekta tylko wtedy, gdy obecny plik zawiera zle zakodowane polskie znaki. Testy powinny nadal wyszukiwac elementy po rolach, etykietach i nazwach dostepnosci.

## Styl

Redesign ma byc spokojny i narzedziowy:

- jasne tlo aplikacji,
- centralny kontener o podobnej szerokosci jak obecnie,
- naglowek z data i glowna akcja dodawania,
- filtr kategorii jako segmentowana kontrolka,
- karty zadan z wyraznym statusem "Dzisiaj" lub zaleglosci,
- akcje na karcie pogrupowane i czytelne,
- formularz szybkiego dodawania jako odrebny panel pod lista.

Nie bedzie duzego dashboardu, hero, dekoracyjnych gradientow ani nowych sekcji marketingowych.

## Obsluga bledow

Istniejace `tasker.storageError` pozostanie obslugiwane w `App.tsx`, ale komunikat zostanie pokazany przez Mantine `Alert`. Nie zmieniamy sposobu odzyskiwania danych ani fallbackow storage.

## Testy i weryfikacja

Po implementacji trzeba uruchomic:

```bash
npm run test:run
npm run build
```

Sukces oznacza, ze testy UI i domenowe przechodza, TypeScript nie zglasza bledow, a Vite buduje aplikacje z zaleznosciami Mantine.
