# Podsumowanie wykonań w widoku „Dzisiaj”

## Cel

W widoku „Dzisiaj” przy każdym zadaniu pokazać, kiedy zostało wykonane ostatnio oraz ile razy wykonano je łącznie.

## Zakres

- Informacja jest widoczna tylko w widoku „Dzisiaj”. Lista „Zadania” pozostaje bez zmian.
- Dla każdego zadania aplikacja wylicza z `state.completions`:
  - najpóźniejszą datę `completedDate` dla jego identyfikatora;
  - liczbę wszystkich rekordów ukończenia dla jego identyfikatora.
- Brak historii jest przedstawiany jako „Jeszcze nie wykonano”.
- Ta sama informacja jest widoczna dla zadań aktywnych oraz oznaczonych jako wykonane dzisiaj.

## Projekt

Model `TodayTask` zostanie rozszerzony o dane podsumowania obliczane w warstwie domenowej. Komponent pojedynczego wiersza w „Dzisiaj” wyświetli zwięzły tekst z datą ostatniego wykonania i liczbą wykonań.

Nie zmieniamy formatu trwałego stanu ani sposobu rejestrowania wykonań.

## Testy

- Test domenowy potwierdzi najpóźniejszą datę oraz liczbę wykonań dla konkretnego zadania.
- Test komponentu potwierdzi wyświetlenie podsumowania oraz komunikatu dla zadania bez historii.
