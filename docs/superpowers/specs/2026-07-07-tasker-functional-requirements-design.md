# Tasker - specyfikacja wymagan funkcjonalnych

Data: 2026-07-07

## Cel dokumentu

Dokument opisuje docelowy zakres funkcjonalny lokalnej wersji aplikacji Tasker. Specyfikacja ma sluzyc jako wspolne zrodlo wymagan dla dalszego projektowania i implementacji. Opisuje funkcje, reguly biznesowe oraz przypadki uzycia z perspektywy uzytkownika.

## Cel aplikacji

Tasker jest lokalna aplikacja do planowania, wykonywania i przegladania zadan jednorazowych oraz cyklicznych. Aplikacja pomaga uzytkownikowi zobaczyc, co wymaga reakcji dzisiaj, zaplanowac przyszle zadania w kalendarzu, utrzymac slowniki porzadkujace zadania oraz zachowac lokalna historie wykonania.

## Zakres docelowy

W zakresie sa:

- lista "Dzisiaj" jako glowny widok pracy,
- osobny widok dodawania i edycji zadan,
- zadania jednorazowe oraz cykliczne,
- zadania oparte na datach kalendarzowych bez godzin,
- oznaczanie zadan jako wykonane,
- odkladanie zadania na jutro albo dowolna wybrana date,
- obsluga zadan zaleglych,
- widok kalendarza z mozliwoscia zarzadzania zadaniami,
- kategorie z kolorami,
- osoby jako proste etykiety przypisania i filtrowania,
- typy zadan jako slownik prezentacyjny,
- opcjonalny priorytet zadania,
- konfiguracja slownikow i opcji zadan,
- historia wykonania zadan,
- import i eksport lokalnych danych.

Poza zakresem tej wersji sa:

- konta uzytkownikow,
- backend,
- synchronizacja miedzy urzadzeniami,
- wspoldzielenie danych z innymi osobami,
- powiadomienia systemowe, push, e-mail albo SMS,
- godziny wykonania zadan,
- statystyki i raporty analityczne.

Synchronizacja, konta i statystyki moga zostac dodane w przyszlych wersjach, ale nie powinny wplywac na projekt tej lokalnej specyfikacji.

## Aktorzy

### Uzytkownik

Jedyna rola w lokalnej wersji aplikacji. Uzytkownik zarzadza zadaniami, kategoriami, slownikami, historia i lokalnymi kopiami danych. Aplikacja nie rozroznia uprawnien ani kont.

## Moduly funkcjonalne

### Dzisiaj

Glowny widok aplikacji. Pokazuje zadania wymagajace reakcji w danym dniu:

- zadania zaplanowane na dzisiaj,
- zadania zalegle z poprzednich dni,
- zadania odlozone na dzisiaj,
- najblizsze wystapienia zadan cyklicznych, ktore powinny byc wykonane.

Widok zawiera przycisk "+ Dodaj zadanie", ktory prowadzi do osobnego formularza tworzenia zadania. Widok "Dzisiaj" nie zawiera pelnego formularza tworzenia zadania.

### Zadania

Modul sluzy do tworzenia i edycji konkretnych zadan. W formularzu zadania uzytkownik ustawia:

- nazwe zadania,
- typ zadania,
- tryb: jednorazowe albo cykliczne,
- date zadania albo date startu cyklu,
- regule powtarzania dla zadania cyklicznego,
- kategorie,
- osobe,
- opcjonalny priorytet,
- aktywnosc zadania.

Po zapisaniu zadanie trafia do planu. Pojawia sie w widoku "Dzisiaj", gdy jego data przypada dzisiaj albo jest zalegla.

### Kalendarz

Kalendarz jest dodatkowym widokiem planowania. Uzytkownik moze:

- przegladac zadania wedlug dat,
- zobaczyc przyszle wystapienia zadan cyklicznych,
- zobaczyc zadania jednorazowe,
- dodac nowe zadanie dla wybranej daty,
- edytowac zadanie z poziomu dnia w kalendarzu,
- odlozyc zadanie na wybrana date.

Widok "Dzisiaj" pozostaje widokiem startowym, a kalendarz jest narzedziem planowania i przegladu.

### Kategorie

Kategorie porzadkuja zadania i pomagaja wizualnie odroznic obszary pracy. Kategoria ma:

- nazwe,
- kolor.

Kolor kategorii jest uzywany w kartach zadan, filtrach i kalendarzu. Kategorie sa zarzadzane w osobnym widoku, a formularz zadania korzysta z gotowej listy kategorii.

### Osoby

Osoba jest prosta etykieta przypisania, np. "Ola" albo "Jan". Osoby sluza do filtrowania i opisu zadania. Nie maja profili, kont, ustawien ani uprawnien.

### Konfiguracja zadan

Konfiguracja zadan sluzy do zarzadzania slownikami i opcjami wykorzystywanymi w formularzu zadania. Nie sluzy do tworzenia konkretnych zadan.

W zakresie konfiguracji sa:

- typy zadan,
- priorytety,
- opcje slownikowe uzywane w zadaniach,
- ustawienia widocznosci albo kolejnosci opcji w formularzu, jesli dany slownik ma byc ukryty albo uporzadkowany inaczej niz alfabetycznie.

Typ zadania ma znaczenie prezentacyjne i filtrujace. Nie zmienia automatycznie zachowania zadania. Na przyklad typ "nawyk" nie wymusza cyklicznosci, a typ "termin" nie wymusza jednorazowosci. O tym decyduje osobne pole trybu zadania.

### Historia

Historia pokazuje wykonania zadan. Uzytkownik moze przegladac, kiedy zadania zostaly wykonane, dla jakiej daty byly zaplanowane i do jakiej kategorii, osoby oraz typu nalezaly.

Historia nie jest w tej wersji modulem statystyk. Nie musi pokazywac wykresow, podsumowan ani wskaznikow efektywnosci.

### Import i eksport

Aplikacja umozliwia eksport wszystkich lokalnych danych do pliku oraz import danych z pliku. Mechanizm sluzy do tworzenia kopii zapasowych i przenoszenia lokalnych danych recznie.

Import powinien walidowac strukture danych i ostrzec uzytkownika, jesli plik jest niepoprawny albo pochodzi z nieobslugiwanej wersji.

## Reguly biznesowe

### Daty

Wszystkie terminy zadan sa zapisywane jako daty kalendarzowe w formacie `YYYY-MM-DD`, bez godziny i bez strefy czasowej. Lista "Dzisiaj" zalezy od lokalnej daty uzytkownika.

### Zadania jednorazowe

Zadanie jednorazowe ma jedna date wykonania. Pojawia sie na liscie "Dzisiaj" w tej dacie. Jesli nie zostanie wykonane, pozostaje widoczne jako zalegle. Po oznaczeniu jako wykonane znika z listy aktywnych zadan. Informacja o wykonaniu trafia do historii.

### Zadania cykliczne

Zadanie cykliczne ma date startu i regule powtarzania. Minimalny zestaw regul:

- codziennie,
- co N dni,
- co tydzien,
- co miesiac,
- co kwartal.

Po wykonaniu zadania cyklicznego aplikacja wylicza kolejny termin od daty faktycznego wykonania, a nie od pierwotnie zaplanowanej daty. Dzieki temu zadanie wykonane pozniej przesuwa swoj kolejny cykl.

### Zaleglosci

Zadanie jest zalegle, jesli jego data albo najblizsze wystapienie przypada przed dzisiejsza data i nie zostalo wykonane. Zalegle zadanie pozostaje widoczne w "Dzisiaj" do momentu wykonania, dezaktywacji albo odlozenia.

### Odkladanie

Uzytkownik moze odlozyc zadanie:

- na jutro,
- na dowolnie wybrana date.

Odkladanie nie jest wykonaniem zadania. Po odlozeniu zadanie znika z aktualnej listy "Dzisiaj" i pojawia sie ponownie w wybranej dacie. Historia wykonania nie jest zmieniana.

### Priorytet

Priorytet jest opcjonalny. Jesli uzytkownik go nie wybierze, zadanie ma domyslna neutralna wartosc albo brak widocznego wyroznienia. Priorytet moze sluzyc do sortowania, filtrowania i wizualnego oznaczenia zadania.

### Aktywnosc zadania

Zadanie moze byc aktywne albo nieaktywne. Nieaktywne zadanie nie pojawia sie na liscie "Dzisiaj" ani w przyszlym planie jako wymagajace reakcji, ale moze pozostac w danych i historii.

## Przypadki uzycia

### UC-01. Przegladanie listy "Dzisiaj"

**Aktor:** Uzytkownik

**Cel:** Zobaczyc zadania wymagajace reakcji dzisiaj.

**Warunki poczatkowe:** Aplikacja ma zapisane zadania albo jest pusta.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera aplikacje.
2. Aplikacja pokazuje widok "Dzisiaj".
3. Aplikacja wylicza zadania zaplanowane na dzisiaj, zalegle i odlozone na dzisiaj.
4. Uzytkownik widzi nazwe, kategorie, kolor kategorii, osobe, typ, priorytet i status terminu.
5. Uzytkownik moze wykonac, odlozyc albo przejsc do edycji zadania.

**Scenariusze alternatywne:**

- Jesli nie ma zadan do pokazania, aplikacja pokazuje stan pusty i przycisk dodania zadania.
- Jesli dane lokalne sa uszkodzone, aplikacja pokazuje komunikat o problemie i nie przerywa dzialania.

### UC-02. Dodanie zadania jednorazowego

**Aktor:** Uzytkownik

**Cel:** Zaplanowac zadanie na konkretna date.

**Scenariusz podstawowy:**

1. Uzytkownik wybiera "+ Dodaj zadanie".
2. Aplikacja otwiera osobny widok formularza zadania.
3. Uzytkownik wpisuje nazwe.
4. Uzytkownik wybiera tryb "jednorazowe".
5. Uzytkownik wybiera date.
6. Uzytkownik wybiera kategorie, osobe, typ i opcjonalny priorytet.
7. Uzytkownik zapisuje zadanie.
8. Aplikacja zapisuje zadanie i pokazuje je w planie.
9. Zadanie pojawi sie w "Dzisiaj" w wybranej dacie albo pozniej jako zalegle.

### UC-03. Dodanie zadania cyklicznego

**Aktor:** Uzytkownik

**Cel:** Utworzyc zadanie powtarzajace sie wedlug wybranej reguly.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera formularz dodawania zadania.
2. Uzytkownik wpisuje nazwe.
3. Uzytkownik wybiera tryb "cykliczne".
4. Uzytkownik ustawia date startu.
5. Uzytkownik wybiera regule powtarzania.
6. Dla reguly "co N dni" uzytkownik podaje liczbe dni.
7. Uzytkownik wybiera kategorie, osobe, typ i opcjonalny priorytet.
8. Uzytkownik zapisuje zadanie.
9. Aplikacja zapisuje zadanie i uwzglednia jego wystapienia w "Dzisiaj" oraz kalendarzu.

**Scenariusze alternatywne:**

- Jesli liczba dni w regule "co N dni" jest mniejsza niz 1, aplikacja wymaga poprawnej wartosci.
- Jesli brakuje wymaganych danych, aplikacja wskazuje pola do uzupelnienia.

### UC-04. Edycja zadania

**Aktor:** Uzytkownik

**Cel:** Zmienic dane istniejacego zadania.

**Scenariusz podstawowy:**

1. Uzytkownik wybiera zadanie z listy, kalendarza albo widoku zadan.
2. Aplikacja otwiera formularz edycji.
3. Uzytkownik zmienia dane zadania.
4. Uzytkownik zapisuje zmiany.
5. Aplikacja aktualizuje zadanie i przelicza jego widocznosc w "Dzisiaj" oraz kalendarzu.

### UC-05. Dezaktywacja zadania

**Aktor:** Uzytkownik

**Cel:** Ukryc zadanie z aktywnego planu bez usuwania jego historii.

**Scenariusz podstawowy:**

1. Uzytkownik wybiera zadanie z listy, kalendarza albo widoku zadan.
2. Uzytkownik wybiera akcje dezaktywacji albo zmienia status zadania na nieaktywne.
3. Aplikacja prosi o potwierdzenie, jesli dezaktywacja usunie zadanie z aktualnej listy pracy.
4. Uzytkownik potwierdza.
5. Aplikacja oznacza zadanie jako nieaktywne.
6. Zadanie nie pojawia sie w "Dzisiaj" ani w przyszlym planie jako wymagajace reakcji.
7. Dotychczasowa historia wykonania pozostaje dostepna.

### UC-06. Oznaczenie zadania jako wykonane

**Aktor:** Uzytkownik

**Cel:** Zamknac aktualne wystapienie zadania.

**Scenariusz podstawowy:**

1. Uzytkownik wybiera akcje "Wykonane" przy zadaniu.
2. Aplikacja zapisuje wykonanie z data dzisiejsza.
3. Aplikacja usuwa zadanie z listy "Dzisiaj".
4. Dla zadania jednorazowego zadanie nie wraca na liste aktywna.
5. Dla zadania cyklicznego aplikacja wylicza kolejny termin od daty faktycznego wykonania.
6. Wykonanie jest widoczne w historii.

### UC-07. Odlozenie zadania

**Aktor:** Uzytkownik

**Cel:** Przesunac reakcje na zadanie na pozniejsza date bez oznaczania go jako wykonane.

**Scenariusz podstawowy:**

1. Uzytkownik wybiera akcje odlozenia.
2. Aplikacja proponuje szybka akcje "jutro" oraz wybor dowolnej daty.
3. Uzytkownik wybiera date.
4. Aplikacja zapisuje odlozenie.
5. Zadanie znika z aktualnej listy "Dzisiaj".
6. Zadanie pojawia sie ponownie w wybranej dacie.

### UC-08. Zarzadzanie kalendarzem

**Aktor:** Uzytkownik

**Cel:** Przegladac i organizowac zadania w czasie.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera kalendarz.
2. Aplikacja pokazuje zadania przypisane do dni.
3. Uzytkownik wybiera dzien.
4. Aplikacja pokazuje zadania z tego dnia.
5. Uzytkownik moze dodac zadanie dla wybranej daty, edytowac zadanie albo odlozyc je na inna date.

### UC-09. Zarzadzanie kategoriami

**Aktor:** Uzytkownik

**Cel:** Utrzymac liste kategorii uzywana w zadaniach.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera widok kategorii.
2. Aplikacja pokazuje liste kategorii.
3. Uzytkownik dodaje albo edytuje kategorie.
4. Uzytkownik podaje nazwe i wybiera kolor.
5. Aplikacja zapisuje kategorie.
6. Kategoria jest dostepna w formularzu zadania, filtrach i kalendarzu.

### UC-10. Zarzadzanie konfiguracja zadan

**Aktor:** Uzytkownik

**Cel:** Zarzadzac slownikami i opcjami uzywanymi przez zadania.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera konfiguracje zadan.
2. Aplikacja pokazuje slowniki, np. typy zadan i priorytety.
3. Uzytkownik dodaje, edytuje, dezaktywuje albo zmienia kolejnosc pozycji slownika.
4. Aplikacja zapisuje konfiguracje.
5. Zmienione opcje sa dostepne w formularzu zadania i filtrach.

**Regula:** Zmiana slownika nie powinna automatycznie zmieniac trybu, daty ani reguly powtarzania istniejacych zadan.

### UC-11. Filtrowanie zadan

**Aktor:** Uzytkownik

**Cel:** Ograniczyc widok do zadan pasujacych do wybranych kryteriow.

**Scenariusz podstawowy:**

1. Uzytkownik wybiera filtr.
2. Aplikacja pozwala filtrowac co najmniej po kategorii, osobie, typie i priorytecie.
3. Aplikacja pokazuje tylko pasujace zadania.
4. Uzytkownik moze wyczyscic filtry.

### UC-12. Przegladanie historii wykonania

**Aktor:** Uzytkownik

**Cel:** Sprawdzic wykonane zadania.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera historie.
2. Aplikacja pokazuje liste wykonania zadan.
3. Kazdy wpis pokazuje zadanie, date planowana, date wykonania, kategorie, osobe i typ.
4. Uzytkownik moze filtrowac historie.

### UC-13. Eksport danych

**Aktor:** Uzytkownik

**Cel:** Utworzyc lokalna kopie danych.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera widok importu i eksportu.
2. Uzytkownik wybiera eksport.
3. Aplikacja tworzy plik z kompletem danych lokalnych.
4. Uzytkownik zapisuje plik na urzadzeniu.

### UC-14. Import danych

**Aktor:** Uzytkownik

**Cel:** Odtworzyc albo przeniesc dane z pliku.

**Scenariusz podstawowy:**

1. Uzytkownik otwiera widok importu i eksportu.
2. Uzytkownik wybiera plik importu.
3. Aplikacja waliduje strukture i wersje danych.
4. Aplikacja pokazuje podsumowanie skutkow importu.
5. Uzytkownik potwierdza import.
6. Aplikacja zapisuje zaimportowane dane lokalnie.

**Scenariusze alternatywne:**

- Jesli plik jest niepoprawny, aplikacja pokazuje blad i nie nadpisuje danych.
- Jesli wersja pliku nie jest obslugiwana, aplikacja pokazuje komunikat i przerywa import.

## Wymagania danych

Docelowy model powinien przechowywac co najmniej:

- zadania,
- wystapienia albo informacje pozwalajace wyliczyc wystapienia,
- wykonania,
- odlozenia,
- kategorie,
- osoby,
- typy zadan,
- priorytety,
- konfiguracje slownikow,
- kompletna strukture lokalnych danych.

Dane sa przechowywane lokalnie w przegladarce albo innym lokalnym magazynie aplikacji. Format danych powinien byc walidowany, aby umozliwic bezpieczny import i wykrywanie uszkodzonych danych.

## Wymagania niefunkcjonalne

- Aplikacja musi dzialac bez polaczenia z internetem po zaladowaniu.
- Aplikacja nie moze wymagac logowania.
- Interfejs powinien byc w jezyku polskim.
- Aplikacja powinna bezpiecznie obslugiwac brak danych, uszkodzone dane i nieobslugiwane wersje danych.
- Logika dat i powtarzania powinna byc oddzielona od komponentow UI i testowalna.
- Zmiany w slownikach nie powinny niszczyc historii ani istniejacych zadan.

## Kryteria akceptacji

Docelowa wersja spelnia specyfikacje, gdy:

- uzytkownik moze dodac zadanie jednorazowe,
- uzytkownik moze dodac zadanie cykliczne z regula powtarzania,
- zadania pojawiaja sie w "Dzisiaj" zgodnie z data, zaleglosciami i odlozeniami,
- uzytkownik moze wykonac zadanie,
- wykonane zadanie jednorazowe znika z listy aktywnej,
- wykonane zadanie cykliczne wylicza kolejny termin od daty faktycznego wykonania,
- uzytkownik moze odlozyc zadanie na jutro albo wybrana date,
- uzytkownik moze zarzadzac zadaniami z kalendarza,
- uzytkownik moze zarzadzac kategoriami z kolorami,
- uzytkownik moze zarzadzac typami zadan i priorytetami,
- osoba dziala jako prosta etykieta przypisania,
- historia wykonania jest dostepna jako lista,
- import nie nadpisuje danych przy blednym pliku,
- eksport tworzy kompletna lokalna kopie danych,
- aplikacja dziala lokalnie bez kont, backendu, synchronizacji i powiadomien.

## Otwarte decyzje na przyszlosc

- sposob pozniejszej synchronizacji danych,
- ewentualne konta uzytkownikow,
- statystyki i raporty,
- ewentualne przeniesienie danych z lokalnego magazynu do backendu,
- rozbudowa typow zadan o zachowania biznesowe, jesli kiedys bedzie potrzebna.
