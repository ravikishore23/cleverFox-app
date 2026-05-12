# pycodes/age_calculator.py
"""Age calculator based on birth year.

Usage:
    python age_calculator.py          # prompts for birth year
    python age_calculator.py 1999      # calculates age for 1999 immediately
"""

import sys
from datetime import date

def calculate_age(birth_year: int, today: date = date.today()) -> int:
    if birth_year > today.year:
        raise ValueError("Birth year cannot be in the future.")
    return today.year - birth_year

def main() -> None:
    if len(sys.argv) > 1:
        input_str = sys.argv[1]
    else:
        input_str = input("Enter your birth year (e.g., 1999): ").strip()
    if not input_str.isdigit():
        print(f"❌ Error: '{input_str}' is not a valid year.")
        sys.exit(1)
    birth_year = int(input_str)
    try:
        age = calculate_age(birth_year)
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    print(f"✅ You are {age} year{'s' if age != 1 else ''} old.")

if __name__ == "__main__":
    main()
