# Propozycja bezpiecznej równoczesnej edycji Taskera

Data: 2026-10-08. Gałąź: `codex/concurrent-task-editing`.
Status: propozycja do przeglądu; opisane zmiany aplikacji nie są wdrożone.

## Cel i kryteria powodzenia

Zmiany wykonane w różnych kartach, sesjach przeglądarki i komputerach mają przetrwać synchronizację, utratę sieci oraz ponowne uruchomienie aplikacji. Edycje różnych zadań mają się łączyć. Sprzeczne zmiany tego samego pola mają pozostać dostępne do rozstrzygnięcia przez użytkownika.

Proponowane założenia: zachować React/Zustand, pracę bez sieci i bezpośrednie połączenie z Tigris. W pierwszym etapie nie dodawać serwera ani kont użytkowników. Bezpieczną synchronizację wielu komputerów zapewnić dla Tigris. Dla JSONHosting nie deklarować tej gwarancji bez potwierdzonego warunkowego zapisu.

## Błędy, które propozycja usuwa

| Problem obecnego kodu | Proponowana ochrona |
| --- | --- |
| Nowszy odczyt zdalny zastępuje niezapisane zmiany lokalne | Stan zdalny staje się podstawą do ponownego zastosowania trwałych operacji lokalnych |
| Dwa zapisy tworzą tę samą rewizję i nadpisują cały dokument | Zapis warunkowy oparty na ETag, czyli identyfikatorze wersji obiektu z usługi |
| Jednakowa rewizja i czas ukrywają różną zawartość | Potwierdzenie przez wersję obiektu i identyfikatory operacji; czas służy tylko do wyświetlania |
| Dwie karty nadpisują localStorage | Wspólna baza IndexedDB, czyli transakcyjna baza przeglądarki, oraz powiadomienia między kartami |
| Ponowne otwarcie usuwa nieprzesłane zmiany | Trwały zapis ostatniej potwierdzonej podstawy, kolejki operacji i konfliktów |
| Odczyt podczas edycji usuwa nową zmianę | Potwierdzenie obejmuje tylko operacje wysłane w danym żądaniu |
| Zmiana stanu aplikacji zeruje otwarty formularz | Formularz zachowuje szkic oraz wersję zadania z chwili rozpoczęcia edycji |

Ostatni problem wynika z `src/components/TaskForm.tsx`: efekt zależny od `state` ponownie ustawia wszystkie wartości formularza. Zewnętrzna aktualizacja stanu może więc usunąć tekst jeszcze przed naciśnięciem „Zapisz”. Ten przypadek wymaga osobnego testu formularza.

## Porównanie podejść

| Podejście | Zalety | Koszt i ograniczenia |
| --- | --- | --- |
| **Zalecane: trwałe operacje + łączenie zmian + warunkowy zapis w Tigris** | Zachowuje obecną architekturę bez serwera; chroni pracę bez sieci i równoczesne zapisy | Nowa warstwa przechowywania, reguły konfliktów i migracja formatu |
| Serwer koordynujący zapisy i baza transakcyjna | Jedno miejsce egzekwowania reguł, łatwiejsze powiadomienia o zmianach | Nowa usługa, utrzymanie, autoryzacja i migracja obu dostawców |
| Samo porównywanie i łączenie pełnych stanów w przeglądarce | Mniejsza zmiana kodu | Nadal występuje wyścig między odczytem a zapisem; nie spełnia celu |

## 1. Trwały model lokalny

Przenieść stan roboczy i metadane synchronizacji do IndexedDB. Zmiana danych, dopisanie operacji i zwiększenie lokalnego numeru wersji odbywają się w jednej transakcji. Interfejs potwierdza zapis dopiero po zatwierdzeniu transakcji. Błąd zapisu pozostawia szkic i pokazuje komunikat.

Dla każdego zestawu danych przechowywać:

- ostatni zatwierdzony stan zdalny, jego rewizję i ETag;
- kolejkę niepotwierdzonych operacji;
- konflikty zawierające wartość podstawową, lokalną i zdalną;
- stan roboczy wyliczony z podstawy i operacji;
- lokalny numer wersji używany do odświeżania kart.

Operacja ma stały `operationId`, identyfikator sesji, rodzaj operacji, identyfikator obiektu oraz wartości pól przed zmianą i po zmianie. Identyfikatory nowych zadań, kategorii, osób i zdarzeń powstają raz, przed zapisaniem operacji. Ponowienie nie generuje nowych identyfikatorów.

Metadane są przypisane do zestawu danych: dostawca + bucket/objectKey albo documentId. Zmiana połączenia nie może przenieść kolejki do innego zestawu. Gdy kolejka jest niepusta, przełączenie wymaga jawnego wyboru: zachować lokalnie, wyeksportować albo dokończyć synchronizację. Samo rozłączenie nie usuwa operacji.

## 2. Reguły łączenia i konfliktów

Dla każdego zmienianego pola porównać wartość z chwili edycji, nową wartość lokalną i obecną wartość zdalną:

- jeśli zdalna wartość jest nadal podstawową, zastosować zmianę lokalną;
- jeśli zdalna wartość jest już równa lokalnej, uznać operację za zastosowaną;
- jeśli obie strony zmieniły wartość różnie, zachować konflikt.

Zmiany różnych zadań oraz różnych pól tego samego zadania łączą się automatycznie. Harmonogram jest jednym polem: nie łączyć oddzielnie trybu, daty i reguły cyklu, aby nie utworzyć niepoprawnego harmonogramu. Dezaktywacja i inne zmiany tego samego zadania wymagają sprawdzenia reguł domenowych; sprzeczne wyniki trafiają do konfliktu.

Konflikt pokazuje nazwę zadania, pole i obie wartości. Użytkownik wybiera „Zachowaj moją zmianę” albo „Przyjmij zmianę zdalną”. Pierwszy wybór tworzy nową operację względem aktualnej wartości zdalnej. Konflikt nie blokuje synchronizacji niezależnych zadań. Operacje zależne od konfliktowego obiektu czekają na rozstrzygnięcie.

Te same reguły obejmują kategorie, osoby, typy zadań i priorytety. Operacja tworząca zadanie oraz potrzebne wpisy słowników stanowi jedną jednostkę. Równoczesne utworzenie kategorii lub osoby o tej samej znormalizowanej nazwie wymaga ujednolicenia identyfikatorów i przepisania odwołań. Nie wolno utracić obiektu wskazywanego przez zadanie.

Wykonanie tego samego wystąpienia zadania deduplikować według `taskId + scheduledDate`; zachować informacje o obu operacjach. Jeśli daty wykonania są różne, zapisać konflikt. Różne wystąpienia pozostają niezależne. Dwa różne odroczenia tego samego wystąpienia są konfliktem. Kolejność słownika traktować jako jedną operację na pełnej liście identyfikatorów; sprzeczne przestawienia wymagają rozstrzygnięcia.

Import całego zestawu danych pozostaje jawną operacją zastąpienia. Przy zmianie podstawy lub oczekujących operacjach w innych kartach nie wykonywać automatycznego zastąpienia: zachować import i poprosić o ponowne potwierdzenie na aktualnych danych. Eksport obejmuje stan roboczy, więc zawiera też nieprzesłane zmiany; osobny eksport diagnostyczny może zawierać operacje i konflikty, bez danych dostępowych.

## 3. Warunkowy zapis Tigris

Adapter odczytu zwraca stan i ETag z tej samej odpowiedzi GET. Adapter zapisu wymaga jednej z dwóch precondition, czyli reguł, które usługa sprawdza przed zapisem:

- `IfMatch: etag` przy aktualizacji istniejącego obiektu;
- `IfNoneMatch: "*"` przy tworzeniu nowego obiektu.

Nie wykonywać automatycznego zapisu bez warunku, również po 404. Brak ETag, brak uprawnienia, zablokowany nagłówek lub niepotwierdzona obsługa warunku oznaczają błąd zachowujący dane lokalne.

Cykl synchronizacji:

1. Odczytaj dokument i ETag.
2. W transakcji lokalnej zapisz nową podstawę, połącz ją z kolejką i zachowaj konflikty. Wybierz stabilną listę operacji do wysłania.
3. Wyślij połączony dokument z warunkiem dotyczącym odczytanego ETag.
4. Po potwierdzonym sukcesie usuń tylko operacje z wysłanej listy. Nowe operacje powstałe w czasie żądania pozostają w kolejce.
5. Przy konflikcie wersji pobierz aktualny dokument i ponów połączenie. Po pięciu konfliktach w jednej próbie pozostaw kolejkę i zaplanuj kolejną próbę z opóźnieniem oraz losowym przesunięciem.
6. Po błędzie sieci ponawiaj z rosnącym opóźnieniem do 60 sekund. Powrót sieci, aktywacja karty i uruchomienie aplikacji uruchamiają próbę. Błędy uprawnień i formatu wymagają interwencji zamiast ciągłego ponawiania.

Zdalny format v2 zawiera identyfikatory zastosowanych operacji. Jeżeli zapis trafił do usługi, ale klient nie dostał odpowiedzi, kolejny odczyt pozwala potwierdzić te operacje bez podwójnego wykonania. W pierwszej wersji nie usuwać tych identyfikatorów z dokumentu; późniejsze ograniczenie ich liczby wymaga osobnego protokołu retencji. Dla dużego dokumentu pokazać błąd zachowujący kolejkę zamiast kasować historię potwierdzeń.

Rewizja rośnie dopiero po udanym warunkowym zapisie. `updatedAt` służy do prezentacji, a nie do wyboru zwycięzcy. Odczyt starszej repliki nie cofa podstawy lokalnej; różna zawartość przy tej samej rewizji wymaga diagnostyki lub ponownego odczytu, nie statusu „zsynchronizowano”.

Tigris deklaruje `If-Match` i `If-None-Match`. Trzeba potwierdzić atomowość dla wybranego rodzaju bucketu i połączeń z różnych regionów. Do czasu testu integracyjnego nie deklarować globalnej gwarancji dla każdego wariantu przechowywania. W CORS (regułach dostępu przeglądarki) dodać nagłówki `If-Match` i `If-None-Match` oraz udostępnić `ETag` w `ExposeHeaders`. Zachować nagłówki wymagane przez podpis AWS; sprawdzić rzeczywiste żądania używanej wersji SDK.

## 4. Karty przeglądarki i formularze

Każda karta zapisuje intencję zmiany w transakcji IndexedDB na aktualnym stanie. Nie zapisuje swojej starej kopii całego dokumentu. Po zatwierdzeniu wysyła powiadomienie przez BroadcastChannel, czyli kanał wiadomości między kartami. Odbiorca odczytuje aktualną wersję z bazy.

Brak BroadcastChannel nie wyłącza poprawności: użyć powiadomienia `storage` o numerze wersji, odświeżania po aktywacji karty oraz okresowej kontroli wersji lokalnej. Powiadomienie zawiera numer wersji, nie stan aplikacji ani dane dostępowe.

Web Locks, czyli blokady współdzielone przez karty, mogą ograniczać liczbę równoległych prób synchronizacji. Poprawność opiera się jednak na transakcjach lokalnych i zapisie warunkowym zdalnym. Zamknięcie karty koordynującej nie może zatrzymać innych kart ani usunąć kolejki. Żądania sieciowe nie trzymają otwartej transakcji IndexedDB.

Otwarty formularz zachowuje wartości i podstawę zadania do chwili zapisania lub anulowania. Zmiana danych z innej sesji nie zeruje formularza. Zapis tworzy operację tylko dla pól zmienionych przez użytkownika względem podstawy formularza. Zdalna zmiana tego samego pola jest rozstrzygana jako konflikt.

## 5. JSONHosting i widoczne zmiany

Publiczna dokumentacja JSONHosting opisuje GET i PATCH, lecz nie dokumentuje sprawdzania oczekiwanej wersji przy zapisie. To brak potwierdzenia możliwości, a nie dowód, że usługa nigdy jej nie obsługuje.

W zalecanym wariancie do czasu potwierdzenia tej możliwości JSONHosting służy do jawnego pobrania lub wysłania kopii. Automatyczne zapisy zostają wstrzymane z komunikatem „Ten dostawca nie zapewnia ochrony równoczesnych zmian. Użyj Tigris do wspólnej edycji”. Istniejące dane dostępowe i dokument pozostają dostępne. Ręczne pobranie również nie zastępuje oczekujących operacji bez rozstrzygnięcia.

To zmiana obecnego działania JSONHosting i wymaga akceptacji przed wdrożeniem. Alternatywa zachowująca automatyczną wspólną edycję w JSONHosting wymaga potwierdzonego mechanizmu warunkowego albo nowego serwera koordynującego wszystkie zapisy. Sama blokada w jednej przeglądarce nie chroni innych komputerów.

Nowe statusy: „Zapisano lokalnie”, „Oczekuje na synchronizację”, „Synchronizacja”, „Wymaga rozstrzygnięcia” i „Zsynchronizowano”. Ostatni status jest dozwolony wyłącznie bez oczekujących operacji i konfliktów, po potwierdzeniu konkretnej wersji zdalnej. Nie oznacza natychmiastowego odświeżenia wszystkich komputerów.

## 6. Migracja i zgodność

- Przed migracją zachować kopię dotychczasowego `tasker:v1` i pobranego dokumentu. Nie usuwać starych danych przed zatwierdzeniem transakcji migracji.
- Lokalny stan bez metadanych nie pozwala odróżnić nieprzesłanej edycji od starej kopii. Gdy różni się od zdalnego, pokazać wybór podstawy i zachować kopię obu wersji. Nie zgadywać na podstawie czasu.
- Zdalny format v1 odczytać, zweryfikować i przekształcić do v2 warunkowym zapisem. Równoległą migrację obsłużyć jak zwykły konflikt ETag.
- Stare karty aplikacji zapisują bez warunku i mogą nadpisać dokument v2. Przy wdrożeniu trzeba zamknąć stare sesje na wszystkich urządzeniach. Pełna ochrona przed starszymi klientami wymaga egzekwowania warunków w polityce usługi, jeśli dostawca to obsługuje, albo oddzielnego nowego klucza obiektu i uprawnień. Nie deklarować bezpieczeństwa przy mieszanych wersjach bez takiej ochrony.
- Zachować format zwykłego eksportu AppState. Migracja i import muszą weryfikować obiekty, odwołania między nimi i harmonogramy, a nie tylko istnienie tablic.

## 7. Zakres plików i kolejność prac

1. Testy odtwarzające utratę zmian: `remoteSync.test.ts`, `taskerStore.test.ts`, testy formularza i nowy zestaw testów dwóch sesji.
2. Czyste reguły operacji i konfliktów: nowe `src/domain/syncOperations.ts` oraz `src/domain/syncMerge.ts` z testami.
3. Transakcyjne przechowywanie i migracja: nowe `src/storage/syncJournal.ts`; integracja z `taskerStorage.ts` i `taskerStore.ts`.
4. Tigris: wynik odczytu z ETag, zapis warunkowy, klasyfikacja konfliktów i walidacja v2 w `tigrisStorage.ts`.
5. Kontroler: przebudowa `remoteSync.ts` na odtwarzanie kolejki, potwierdzanie operacji i ponawianie; powiadomienia kart w osobnym module.
6. Formularz i widok danych: zachowanie szkicu, prezentacja konfliktów, statusów i ograniczenia JSONHosting.
7. Dokumentacja konfiguracji bucketu, przejścia na v2 i wymagań dla wszystkich urządzeń.

To kolejność proponowanych zmian, nie gotowy plan wykonawczy. Przed wdrożeniem ustalić zakres pierwszego etapu, politykę konfliktów i tryb JSONHosting.

## 8. Testy akceptacyjne

| Scenariusz | Oczekiwany wynik |
| --- | --- |
| Dwa komputery edytują różne zadania | Obie zmiany pozostają; sesje dochodzą do tej samej zawartości |
| Dwa komputery edytują różne pola jednego zadania | Pola łączą się bez utraty zmian |
| Dwie różne wartości jednego pola | Konflikt z obiema wartościami; brak cichego nadpisania |
| Dwa klienty odczytują ten sam ETag i zapisują równocześnie | Jedna pierwsza próba jest odrzucona; po ponowieniu zachowane są obie niezależne zmiany |
| Identyczne lub rozbieżne zegary komputerów | Wynik i wykrycie konfliktu nie zależą od czasu |
| Edycja podczas GET lub PUT | Nowa operacja pozostaje w kolejce; odpowiedź nie usuwa jej |
| Edycja bez sieci, zamknięcie, ponowne otwarcie | Operacja przetrwa i synchronizuje się po powrocie sieci |
| PUT wykonany, odpowiedź utracona | Ponowienie nie duplikuje zadania, wykonania ani odroczenia |
| Dwie karty dodają zadania równocześnie | Oba zadania w bazie lokalnej także bez usługi zdalnej |
| Zamknięcie karty koordynującej lub brak Web Locks | Inna karta kontynuuje; dane pozostają poprawne |
| Otwarty formularz i zdalna aktualizacja | Szkic nie znika; zapis wykrywa konflikt względem podstawy edycji |
| Równoczesne pierwsze połączenie lub migracja | Jeden warunkowy zapis; kolejny klient zachowuje własne dane i łączy zmiany |
| Zmiana dostawcy lub obiektu z niepustą kolejką | Operacje nie trafiają do innego zestawu danych |
| Kategorie, słowniki, wykonania i odroczenia | Brak błędnych odwołań, podwójnych wykonań i zgubionych zdarzeń |
| JSONHosting bez potwierdzonego warunku zapisu | Brak automatycznej obietnicy bezpiecznej wspólnej edycji |
| Wdrożenie przy aktywnym starszym kliencie | Blokada jego zapisu albo jawna niespełniona przesłanka wdrożenia |

Testy jednostkowe sterują kolejnością odpowiedzi oraz awariami. Testy dwóch kontekstów przeglądarki sprawdzają karty współdzielące i niewspółdzielące pamięć. Test integracyjny korzysta wyłącznie z osobnego obiektu testowego Tigris, potwierdza ETag, odrzucenie nieaktualnego zapisu i CORS oraz, przed gwarancją międzyregionalną, wykonuje zapisy z dwóch regionów. Dane dostępowe do produkcji nie są potrzebne do testów jednostkowych.

## Źródła i przesłanki

- Kod projektu: `src/state/remoteSync.ts`, `src/state/taskerStore.ts`, `src/storage/tigrisStorage.ts`, `src/storage/jsonHostingStorage.ts`, `src/components/TaskForm.tsx`.
- Audyt z 2026-10-08: 72 istniejące testy synchronizacji i przechowywania przeszły; dodatkowe pięć odtworzeń wykazało utratę zmian. Odtworzenia używały rzeczywistego kodu z symulowaną usługą, bez zapisów do produkcji.
- [Tigris — Conditional writes i spójność danych](https://www.tigrisdata.com/features/): deklaruje If-Match/If-None-Match; opis spójności różni się zależnie od rodzaju bucketu. Szczegółowa strona warunków nie była dostępna w narzędziu przeglądania; dlatego dokument nie traktuje konkretnych kodów odpowiedzi i atomowości międzyregionalnej jako zweryfikowanych.
- [JSONHosting — dokumentacja API](https://jsonhosting.com/#api): dokumentuje zapis PATCH z kluczem edycji; nie dokumentuje warunkowego zapisu w odczytanej treści.

Starszy opis README „Tigris does not provide compare-and-swap protection for this flow” należy doprecyzować: obecny kod nie używa deklarowanej przez usługę ochrony warunkowego zapisu.
