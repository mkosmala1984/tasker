# Tasker - redesign operacyjnego widoku "Dzisiaj"

Data: 2026-07-10

## Cel

Celem zmiany jest przeksztalcenie widoku "Dzisiaj" z prostego ekranu listy zadan w operacyjny ekran domykania biezacych i zaleglych obowiazkow. Widok ma pomagac szybko odpowiedziec na trzy pytania:

- co wymaga uwagi teraz,
- jak bardzo zadanie jest opoznione,
- czy wykonac je teraz, czy odlozyc.

Redesign obejmuje warstwe wizualna i zachowanie ekranu. Nie jest to tylko zmiana stylu kart, ale przebudowa przeplywu interakcji na potrzeby szybkiej pracy dziennej.

## Zakres

W zakresie sa:

- usuniecie filtrow renderowanych nad lista zadan w widoku "Dzisiaj",
- nowy naglowek ekranu z tytulem, data i licznikiem otwartych zadan,
- przebudowa listy aktywnych zadan do postaci operacyjnych wierszy,
- dodanie rozwijanych szczegolow zadania pod wierszem,
- dodanie szybkiej akcji `Odloz` jako menu z gotowymi opcjami,
- dodanie sekcji `Wykonane dzisiaj` jako zwijanej listy,
- natychmiastowe przenoszenie zadania do sekcji wykonanych po akcji `Wykonane`,
- utrzymanie obecnej logiki domenowej, lokalnego storage i nawigacji aplikacji.

Poza zakresem sa:

- przebudowa modelu danych calej aplikacji,
- dodawanie nowych filtrow lub zaawansowanego wyszukiwania do widoku "Dzisiaj",
- zmiany w widokach `Zadania`, `Kalendarz` i `Kategorie`, poza ewentualnymi drobnymi dostosowaniami wspolnych komponentow,
- synchronizacja online, konta uzytkownikow i backend,
- rozbudowane cofanie akcji `Wykonane`,
- osobny ekran szczegolow zadania.

## Kontekst produktowy

Widok "Dzisiaj" jest traktowany jako domyslny punkt wejscia do aplikacji i centrum wykonywania pracy. Pozostale sekcje pozostaja miejscem zarzadzania, planowania i konfiguracji.

Najwazniejsza jednostka interfejsu to zadanie, nie kalendarz. Daty i opoznienia maja wspierac decyzje operacyjne, a nie planowanie godzinowe. Najsilniejszy sygnal wizualny ma dawac opoznienie wyrazone liczba dni po terminie. Dominuja dwie akcje:

- `Wykonane`,
- `Odloz`.

Rzadziej uzywane operacje pozostaja drugorzedne wzgledem glownej sciezki pracy.

## Architektura UI

Widok "Dzisiaj" powinien zostac rozbity na wyspecjalizowane komponenty warstwy prezentacji:

- `TodayViewShell` - kontener sekcji ekranu,
- `TodaySummaryHeader` - naglowek z tytulem, data i licznikiem zadan,
- `TodayActiveList` - lista aktywnych pozycji wymagajacych reakcji,
- `TodayTaskRow` - podstawowy, zwarty wiersz zadania,
- `TodayTaskDetailsPanel` - rozwijany panel metadanych i kontekstu,
- `TodayPostponeMenu` - szybkie menu odkladania,
- `TodayCompletedSection` - zwijana sekcja zadan wykonanych w biezacym dniu.

Istniejace komponenty `TodayTaskList` i `TodayTaskCard` moga zostac przepisane lub zastapione nowymi odpowiednikami, ale logika domenowa nie powinna byc przenoszona do pojedynczych kart. Granica odpowiedzialnosci ma zostac taka:

- domena i store odpowiadaja za dane zadan, ich status oraz operacje wykonania i odkladania,
- komponenty widoku odpowiadaja za prezentacje, lokalny stan rozwiniecia i wywolywanie akcji.

Komponent `TaskFilters` nie powinien byc renderowany w widoku "Dzisiaj". To jest decyzja produktowa, nie tymczasowe ukrycie CSS.

## Model widoku i przeplyw stanu

Redesign powinien pozostac oparty o obecne dane `TodayTask`, ale widok potrzebuje dodatkowego modelu prezentacyjnego:

- lista aktywnych pozycji na dzis i zaleglych,
- lista pozycji wykonanych dzisiaj,
- informacja, ktore zadanie jest rozwiniiete,
- informacja, dla ktorego zadania otwarte jest menu `Odloz`,
- stan rozwiniecia sekcji `Wykonane dzisiaj`,
- tymczasowy stan wyboru daty przy opcji `wybierz date`.

Ten stan powinien pozostac lokalny dla widoku "Dzisiaj", o ile nie jest potrzebny w innych ekranach. Nie ma potrzeby zapisywania stanu rozwinietych kart ani otwartego menu do storage.

Po akcji `Wykonane` zadanie ma zostac od razu usuniete z listy aktywnej i pokazane w sekcji `Wykonane dzisiaj`. Uzytkownik nie wykonuje dodatkowego potwierdzenia. Widok ma dawac natychmiastowe poczucie postepu.

## Zachowanie aktywnej listy

Kazdy wiersz zadania w stanie zwinietym pokazuje:

- pole zaznaczenia lub wizualny uchwyt po lewej stronie,
- tytul zadania,
- status `Jeszcze nie wykonano` albo `Ostatnio wykonane: <data>`,
- badge opoznienia oparty o liczbe dni po terminie,
- przycisk `Wykonane`,
- przycisk `Odloz`,
- przycisk rozwijania szczegolow,
- menu dodatkowych akcji, jesli pozostaje potrzebne.

Szczegoly zadania sa ukryte domyslnie i pojawiaja sie dopiero po rozwinieciu wiersza. Panel szczegolow powinien zawierac tylko dane wspierajace decyzje lub zrozumienie kontekstu, na przyklad:

- kategoria,
- powtarzanie,
- nastepny termin,
- typ zadania,
- przypisana osoba,
- priorytet,
- notatka,
- data utworzenia.

Panel szczegolow rozwija sie inline pod aktywnym wierszem, bez nawigacji do innego widoku.

## Zachowanie akcji `Odloz`

Akcja `Odloz` ma byc szybka i operacyjna. Klikniecie otwiera male menu, a nie pelny formularz.

Pierwsza wersja menu powinna wspierac:

- `Jutro`,
- `Za tydzien`,
- `Wybierz date`.

Opcje gotowe wykonuja akcje od razu. Opcja `Wybierz date` otwiera lekki picker daty w kontekscie tego samego zadania. Nie przechodzimy do osobnego modala, jesli nie wymaga tego ograniczenie biblioteki komponentow.

Po udanym odlozeniu zadanie powinno zniknac z glownej listy "Dzisiaj", jesli nowa data powoduje, ze nie nalezy juz do biezacego widoku.

## Sekcja `Wykonane dzisiaj`

Na dole widoku powinna pojawic sie zwijana sekcja `Wykonane dzisiaj`, domyslnie pokazujaca co najmniej naglowek z licznikiem wykonanych pozycji.

Ta sekcja ma dwa cele:

- utrzymac glowna liste aktywna i czysta,
- dawac uzytkownikowi informacje zwrotna o postepie w biezacym dniu.

Pozycje wykonane nie powinny konkurowac wizualnie z lista aktywna. Moga miec prostsza reprezentacje niz aktywne wiersze, ale powinny pozostac czytelne i latwe do przejrzenia po rozwinieciu sekcji.

## Hierarchia wizualna

Widok ma byc spokojny, jasny i narzedziowy, ale bardziej celowy niz obecny ekran. Priorytety hierarchii:

- najmocniejsze: tytul ekranu, nazwy zadan, licznik otwartych zadan, badge opoznienia, przycisk `Wykonane`,
- drugorzedne: status ostatniego wykonania, etykiety pol, metadane w szczegolach,
- wspierajace: przycisk rozwijania, dodatkowe menu, subtelne separatory.

Kolory powinny wspierac znaczenie:

- zielony dla pozytywnej akcji i sygnalu postepu,
- cieple kolory dla opoznien i ostrzezen,
- neutralne tlo i obramowania dla utrzymania skanowalnosci.

Projekt ma pozostac desktop-first, ale nie moze psuc podstawowej obslugi na mniejszych szerokosciach. Na waskich ekranach akcje moga sie zawijac lub przechodzic do bardziej pionowego ukladu.

## Dostepnosc i interakcje

Widok musi pozostac obslugiwalny z klawiatury:

- przyciski `Wykonane`, `Odloz` i rozwijanie szczegolow musza miec czytelne nazwy dostepnosci,
- menu `Odloz` musi miec poprawny fokus i byc zamykalne z klawiatury,
- sekcja wykonanych musi sygnalizowac stan zwiniecia i rozwiniecia,
- dynamiczne zmiany listy po `Wykonane` nie moga gubic fokusu w nieprzewidywalny sposob.

Jesli po wykonaniu zadania element znika z listy, fokus powinien przejsc do sensownego sasiedniego elementu albo pozostac w obrebie listy w przewidywalnym miejscu.

## Wplyw na kod

Najbardziej prawdopodobne miejsca zmian:

- `src/App.tsx` lub nadrzedny komponent ekranu "Dzisiaj",
- `src/components/TodayTaskList.tsx`,
- `src/components/TodayTaskCard.tsx`,
- nowy zestaw komponentow pod `src/components/today/` lub podobna strukture,
- ewentualne selektory lub pomocnicze funkcje w store dla listy wykonanych dzisiaj,
- testy komponentow i testy zachowania widoku.

Jesli obecne komponenty sa zbyt ogolne lub zbyt male wobec nowego projektu, lepiej wprowadzic nowy zestaw komponentow dedykowanych widokowi operacyjnemu niz przeciagac stary interfejs na sile.

## Testy i weryfikacja

Po implementacji nalezy sprawdzic co najmniej:

- render naglowka z data i licznikiem,
- brak filtrow nad lista w widoku "Dzisiaj",
- natychmiastowe przeniesienie zadania do sekcji `Wykonane dzisiaj` po kliknieciu `Wykonane`,
- otwieranie menu `Odloz` i dzialanie opcji `Jutro`, `Za tydzien` i `Wybierz date`,
- rozwijanie i zwijanie szczegolow zadania,
- poprawne oznaczenie opoznien i tekstu ostatniego wykonania,
- zachowanie sekcji wykonanych przy braku i przy obecnosci danych,
- przejscie testow domenowych i builda aplikacji.

Minimalna weryfikacja koncowa:

```bash
npm run test:run
npm run build
```
