/**
 * Converts a number into words (Indian Numbering System)
 * e.g., 33017 -> "Thirty Three Thousand Seventeen Only"
 */
export function numberToWords(num: number): string {
    if (typeof num !== 'number' || isNaN(num) || num <= 0) return 'Zero Only';

    const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function format(n: number): string {
        if (n < 20) return a[n];
        const tens = b[Math.floor(n / 10)];
        const ones = a[n % 10];
        return ones ? `${tens} ${ones}` : tens;
    }

    function generate(n: number): string {
        if (n === 0) return '';
        if (n < 100) return format(n);
        if (n < 1000) {
            const hundred = a[Math.floor(n / 100)];
            const rest = generate(n % 100);
            return rest ? `${hundred} Hundred ${rest}` : `${hundred} Hundred`;
        }
        if (n < 100000) {
            const thousand = generate(Math.floor(n / 1000));
            const rest = generate(n % 1000);
            return rest ? `${thousand} Thousand ${rest}` : `${thousand} Thousand`;
        }
        if (n < 10000000) {
            const lakh = generate(Math.floor(n / 100000));
            const rest = generate(n % 100000);
            return rest ? `${lakh} Lakh ${rest}` : `${lakh} Lakh`;
        }
        const crore = generate(Math.floor(n / 10000000));
        const rest = generate(n % 10000000);
        return rest ? `${crore} Crore ${rest}` : `${crore} Crore`;
    }

    const words = generate(Math.floor(num));
    return `Rupees ${words.trim()} Only`.replace(/\s+/g, ' ');
}
