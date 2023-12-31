/**
 * Sleep for a given amount of time.
 * @param ms - The number of milliseconds to sleep for. Defaults to 1000.
 * @returns A promise that resolves when the sleep is complete.
 */
export async function sleep(ms = 1000) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
