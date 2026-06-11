/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'sci-fi-bg': '#050a14',
                'sci-fi-blue': '#00f0ff',
                'sci-fi-red': '#ff003c',
                'sci-fi-teal': '#00ff9d',
            },
            fontFamily: {
                'orbitron': ['Orbitron', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
