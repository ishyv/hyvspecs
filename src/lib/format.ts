// mb → shortest human unit. shared by the card chrome and the in-scene part labels so a
// capacity reads the same everywhere: "2 tb", "32 gb", "512 mb".
export function cap(mb: number): string {
	if (mb >= 1024 * 1024) return +(mb / 1048576).toFixed(1) + ' tb';
	if (mb >= 1024) return Math.round(mb / 1024) + ' gb';
	return mb + ' mb';
}
