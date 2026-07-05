# Tasker - specyfikacja wymagań MVP

Data: 2026-07-05

## Cel

Tasker to lokalna aplikacja webowa do planowania i odhaczania zadań powtarzalnych. Pierwsza wersja ma działać w przeglądarce, bez backendu, kont użytkowników i synchronizacji między urządzeniami. Dane są zapisywane lokalnie w przeglądarce.

## Zakres MVP

Aplikacja ma umożliwiać:

- wyświetlanie listy zadań do wykonania dzisiaj,
- definiowanie zadań powtarzalnych,
- oznaczanie zadań jako wykonane,
- odkładanie zadania na kolejny dzień,
- automatyczne przenoszenie niewykonanych zadań na kolejne dni,
- kategoryzowanie zadań,
- przypisywanie zadań do osoby,
- filtrowanie listy po kategorii i osobie,
- edycję oraz dezaktywację istniejących zadań.

Poza zakresem MVP są:

- backend,
- logowanie,
- synchronizacja między urządzeniami,
- współdzielenie danych między wieloma użytkownikami,
- prawdziwe powiadomienia systemowe, e-mail albo push,
- kalendarz miesięczny,
- raporty i statystyki,
- import oraz eksport danych.

## Technologia

Pierwsza wersja zostanie zbudowana jako aplikacja React:

- React,
- Vite,
- TypeScript,
- `localStorage` jako lokalny magazyn danych,
- bez serwera aplikacyjnego,
- bez bazy danych po stronie serwera.

Aplikacja powinna być możliwa do uruchomienia lokalnie przez standardowy workflow frontendowy, np. `npm install` i `npm run dev`. Dane użytkownika pozostają w tej samej przeglądarce, w której zostały zapisane.

## Założenia UX

Głównym ekranem aplikacji jest lista "Dzisiaj". Użytkownik po wejściu do aplikacji od razu widzi zadania, które wymagają reakcji.

Każdy element listy powinien pokazywać co najmniej:

- nazwę zadania,
- kategorię,
- osobę przypisaną,
- informację, czy zadanie jest zaległe,
- akcję "Wykonane",
- akcję "Odłóż na jutro".

Jeżeli nie ma żadnych zadań na dzisiaj, aplikacja pokazuje stan pusty z możliwością dodania nowego zadania.

## Reguły powtarzania

Zadanie może mieć jedną z następujących reguł powtarzania:

- codziennie,
- co N dni,
- co tydzień,
- co miesiąc,
- co kwartał.

Każde zadanie ma datę startu. Data startu określa pierwszy dzień, w którym zadanie może pojawić się na liście "Dzisiaj".

Zadanie trafia na listę "Dzisiaj", jeżeli:

- jego następna planowana data jest dzisiaj albo wcześniej,
- zadanie jest aktywne,
- zadanie nie zostało wykonane dla bieżącego wystąpienia,
- zadanie nie zostało odłożone z dzisiejszej daty na jutro.

## Zachowanie zaległych zadań

Jeżeli zadanie pojawi się na liście "Dzisiaj" i nie zostanie oznaczone jako wykonane, pozostaje widoczne kolejnego dnia. Dzieje się tak aż do momentu, gdy użytkownik oznaczy je jako wykonane albo odłoży je na kolejny dzień.

Zaległe zadanie powinno być widocznie oznaczone jako zaległe, np. przez etykietę "Zaległe" oraz pokazanie pierwotnej daty planowanej.

## Odkładanie zadania na jutro

Akcja "Odłóż na jutro" nie jest wykonaniem zadania.

Po odłożeniu:

- zadanie znika z listy "Dzisiaj",
- zadanie pojawia się ponownie następnego dnia,
- aplikacja zapisuje informację o odłożeniu,
- historia wykonań nie jest zmieniana,
- jeżeli następnego dnia zadanie nadal nie zostanie wykonane, zachowuje się jak zaległe i przechodzi na kolejne dni.

Po wykonaniu odłożonego zadania kolejny termin cyklu jest liczony od dnia faktycznego wykonania.

## Oznaczanie zadania jako wykonane

Po kliknięciu "Wykonane":

- aplikacja zapisuje datę wykonania,
- bieżące wystąpienie znika z listy "Dzisiaj",
- aplikacja wylicza kolejną planowaną datę na podstawie reguły powtarzania,
- kolejna data jest liczona od dnia faktycznego wykonania.

Przykład: zadanie cykliczne co 7 dni było zaplanowane na 2026-07-01, ale wykonano je dopiero 2026-07-03. Następna data wypada 2026-07-10.

## Kategorie i osoby

Każde zadanie może mieć przypisaną jedną kategorię i jedną osobę.

W MVP kategorie i osoby mogą być tworzone bezpośrednio przy dodawaniu lub edycji zadania. Aplikacja powinna przechowywać listę używanych kategorii i osób, aby można było je wybierać ponownie.

Filtrowanie listy "Dzisiaj" powinno pozwalać ograniczyć widok do:

- jednej kategorii,
- jednej osoby,
- kombinacji kategorii i osoby.

## Model danych

Dane powinny być przechowywane pod wersjonowanym kluczem w `localStorage`, np. `tasker:v1`.

Minimalny model danych:

```ts
type Task = {
  id: string;
  title: string;
  categoryId: string;
  assigneeId: string;
  recurrence: RecurrenceRule;
  startDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type RecurrenceRule =
  | { type: "daily" }
  | { type: "everyNDays"; intervalDays: number }
  | { type: "weekly" }
  | { type: "monthly" }
  | { type: "quarterly" };

type Category = {
  id: string;
  name: string;
};

type Assignee = {
  id: string;
  name: string;
};

type Completion = {
  id: string;
  taskId: string;
  scheduledDate: string;
  completedDate: string;
};

type Postponement = {
  id: string;
  taskId: string;
  fromDate: string;
  toDate: string;
  createdAt: string;
};

type AppState = {
  version: 1;
  tasks: Task[];
  categories: Category[];
  assignees: Assignee[];
  completions: Completion[];
  postponements: Postponement[];
};
```

Daty powinny być zapisywane jako lokalne daty kalendarzowe w formacie `YYYY-MM-DD`, bez czasu i bez strefy czasowej. Dzięki temu lista "Dzisiaj" nie zależy od przesunięć godzinowych.

## Architektura aplikacji

Logika domenowa powinna być oddzielona od komponentów UI.

Proponowane moduły:

- `storage` - odczyt i zapis stanu w `localStorage`,
- `recurrence` - wyliczanie kolejnych dat wystąpień,
- `todayList` - budowanie listy zadań na dzisiaj,
- `tasks` - operacje dodawania, edycji, dezaktywacji, wykonania i odłożenia zadania,
- `components` - komponenty React.

Komponenty React nie powinny samodzielnie wyliczać reguł powtarzania. Powinny korzystać z funkcji domenowych, które można testować niezależnie.

## Obsługa błędów i danych uszkodzonych

Aplikacja powinna obsłużyć sytuacje, w których:

- w `localStorage` nie ma jeszcze danych,
- dane w `localStorage` są niepoprawnym JSON-em,
- dane mają nieznaną wersję,
- zadanie odwołuje się do usuniętej kategorii lub osoby.

W MVP wystarczy bezpieczny fallback: pokazanie pustego stanu aplikacji albo komunikatu o problemie z lokalnymi danymi. Aplikacja nie powinna przestać działać przez uszkodzony zapis.

## Testy

Priorytetem testów są funkcje domenowe:

- wyliczanie kolejnej daty dla każdej reguły powtarzania,
- pojawianie się zaległych zadań na liście "Dzisiaj",
- ukrycie zadania po odłożeniu na jutro,
- powrót odłożonego zadania następnego dnia,
- liczenie kolejnego terminu od daty faktycznego wykonania,
- filtrowanie po kategorii i osobie,
- odporność na brak danych w `localStorage`.

Testy UI mogą być ograniczone do najważniejszych przepływów MVP:

- dodanie zadania,
- oznaczenie zadania jako wykonane,
- odłożenie zadania na jutro,
- filtrowanie listy "Dzisiaj".

## Kryteria akceptacji MVP

MVP jest gotowe, gdy:

- użytkownik może dodać zadanie z kategorią, osobą, datą startu i regułą powtarzania,
- lista "Dzisiaj" pokazuje zadania zaplanowane na dzisiaj,
- lista "Dzisiaj" pokazuje zaległe niewykonane zadania z poprzednich dni,
- kliknięcie "Wykonane" usuwa zadanie z listy i zapisuje wykonanie,
- po wykonaniu zadania kolejna data jest liczona od daty faktycznego wykonania,
- kliknięcie "Odłóż na jutro" usuwa zadanie z dzisiejszej listy bez zapisywania wykonania,
- odłożone zadanie pojawia się następnego dnia,
- użytkownik może filtrować listę po kategorii i osobie,
- dane pozostają dostępne po odświeżeniu strony,
- aplikacja nie wymaga backendu do działania.

