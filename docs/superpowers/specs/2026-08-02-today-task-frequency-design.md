# Częstotliwość zadania w widoku „Dzisiaj”

## Cel

W rozwiniętych szczegółach zadania w zakładce „Dzisiaj” pokazać częstotliwość jego harmonogramu.

## Zakres

- Widok dotyczy wyłącznie `TodayTaskDetailsPanel`.
- Zasady są prezentowane jako liczba dni: `Co 1 dzień`, `Co N dni`, `Co 7 dni`, `Co 30 dni` i `Co 90 dni`.
- Zadanie jednorazowe wyświetla `Jednorazowo`.
- Nie zmieniamy modelu danych ani zapisu zadań.

## Projekt

`TodayTaskDetailsPanel` otrzyma lokalną funkcję formatującą harmonogram z `item.task.schedule`. Panel wyświetli nowe pole `Częstotliwość` w tym samym układzie siatki, co obecne metadane. Test komponentu sprawdzi format dla zadania jednorazowego oraz harmonogramu „co N dni”.

## Testy

- Komponent pokazuje `Jednorazowo` dla `mode: "oneTime"`.
- Komponent pokazuje `Co 3 dni` dla reguły `everyNDays` z interwałem 3.
