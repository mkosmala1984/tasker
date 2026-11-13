# Wgrywanie tła tablicy

## Cel

Użytkownik wybiera grafikę jako tło tablicy w widoku „Dzisiaj”. Grafika pozostaje dostępna po ponownym otwarciu aplikacji i synchronizuje się przez Tigris między urządzeniami.

## Zachowanie

- Sekcja „Tło tablicy” w widoku „Konfiguracja” zawiera wybór pliku, podgląd oraz przycisk „Przywróć domyślne tło”.
- Obsługiwane formaty: PNG, JPEG i WebP. Proponowany limit pliku: 5 MB.
- Poprawna grafika zapisuje się po wyborze pliku. Aplikacja potwierdza zapis dopiero po zakończeniu transakcji bazy danych.
- Błąd odczytu, niepoprawny obraz lub błąd zapisu pozostawia dotychczasowe tło i wyświetla komunikat.
- Tło pokrywa tablicę tak jak obecnie. Karty zadań zachowują jednolite tło.
- Przywrócenie domyślnego tła usuwa własną grafikę z bieżących ustawień. Ta zmiana również podlega synchronizacji.

## Zapis i synchronizacja

Grafika i jej nazwa stanowią jedno ustawienie w stanie aplikacji. Zawartość pliku jest zapisana jako ciąg danych obrazu, bez zależności od lokalnej ścieżki. Stan jest przechowywany w IndexedDB i synchronizowany przez obecny mechanizm Tigris. Eksport i import obejmują własne tło. Starsze dane bez tego ustawienia nadal otwierają się z domyślnym tłem.

Równoczesne zmiany tła na dwóch urządzeniach korzystają z obecnego mechanizmu rozstrzygania konfliktów. W interfejsie konfliktów należy wyświetlać nazwę grafiki zamiast całej zawartości pliku.

## Rozważone sposoby

1. Grafika w obecnym zestawie danych: wspólny zapis, synchronizacja i kopie danych. Wybrany sposób; zwiększa rozmiar synchronizowanego dokumentu o zakodowaną grafikę.
2. Osobny obiekt w Tigris: mniejszy dokument z zadaniami, ale wymaga dodatkowej obsługi przesyłania, odwołań i usuwania osieroconych plików. Nie jest potrzebny przy pojedynczym tle z ograniczonym rozmiarem.

## Weryfikacja

Testy zapisu i odczytu tła, zgodności ze starszymi danymi, synchronizacji między urządzeniami i konfliktów. Testy interfejsu obejmują wybór pliku, odrzucenie niepoprawnego pliku i przywrócenie domyślnego tła. Na koniec testy projektu i kompilacja.

## Poza zakresem

Galeria wielu teł, kadrowanie, zmiana przezroczystości oraz osobne tło dla każdej kategorii.
