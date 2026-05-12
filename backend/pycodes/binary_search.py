def binary_search(arr, target):
    """Return the index of target in sorted list arr, or -1 if not found."""
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

if __name__ == "__main__":
    # Example usage
    data = [1, 3, 5, 7, 9, 11, 13]
    target = 7
    index = binary_search(data, target)
    print(f"Target {target} found at index: {index}")
