const glyphs = {
    A: [91, "M20 0H71L91 100H56L52 78H39L35 100H0ZM44 32L41 59H50L47 32Z", "M44 0H46V33H44Z"],
    B: [88, "M0 0H53Q85 0 85 27Q85 42 72 48Q88 53 88 73Q88 100 55 100H0ZM36 23V40H45Q53 40 53 31Q53 23 45 23ZM36 61V78H47Q55 78 55 69Q55 61 47 61Z", "M35 23H37V100H35Z"],
    C: [91, "M91 37H56V33Q56 28 48 28Q39 28 39 35V66Q39 73 48 73Q56 73 56 66V62H91V70Q91 102 47 102Q0 102 0 67V34Q0-2 47-2Q91-2 91 31Z"],
    D: [93, "M0 0H49Q93 0 93 40V60Q93 100 49 100H0ZM38 32V68H46Q55 68 55 59V41Q55 32 46 32Z", "M37 32H39V100H37Z"],
    E: [79, "M0 0H79V29H38V35H74V64H38V71H79V100H0Z", "M37 0H39V30H37ZM38 29H79V32H38Z"],
    F: [78, "M0 0H78V31H38V40H71V69H38V100H0Z", "M37 0H39V32H37Z"],
    G: [94, "M94 35H57V32Q57 27 49 27Q39 27 39 36V66Q39 75 49 75Q59 75 59 69V64H47V43H94V71Q94 102 48 102Q0 102 0 67V34Q0-2 48-2Q94-2 94 30Z", "M47 64H49V102H47Z"],
    H: [91, "M0 0H37V34H54V0H91V100H54V67H37V100H0Z"],
    I: [37, "M0 0H37V100H0Z"],
    J: [79, "M41 0H79V68Q79 102 38 102Q0 102 0 71V58H33V69Q33 76 38 76Q41 76 41 69Z"],
    K: [94, "M0 0H37V36L53 0H94L68 49L96 100H54L37 62V100H0Z"],
    L: [75, "M0 0H38V100H0ZM41 66H75V100H41Z"],
    M: [111, "M0 0H40L55 38L71 0H111V100H76V51L61 84H49L35 51V100H0Z"],
    N: [94, "M0 0H37L59 40V0H94V100H57L35 60V100H0Z"],
    O: [99, "M49-2Q99-2 99 44V56Q99 102 49 102Q0 102 0 56V44Q0-2 49-2ZM49 33Q40 33 40 43V57Q40 67 49 67Q59 67 59 57V43Q59 33 49 33Z", "M58 57H60V102H58Z"],
    P: [88, "M0 0H48Q88 0 88 36Q88 70 48 70H38V100H0ZM38 28V45H44Q53 45 53 36Q53 28 44 28Z", "M37 28H39V100H37Z"],
    Q: [99, "M49-2Q99-2 99 44V56Q99 78 86 91L99 106H60L54 101H49Q0 101 0 56V44Q0-2 49-2ZM49 33Q40 33 40 43V57Q40 67 49 67Q59 67 59 57V43Q59 33 49 33Z"],
    R: [96, "M0 0H53Q94 0 94 33Q94 56 73 63L98 100H57L39 67V100H0ZM39 28V47H46Q56 47 56 37Q56 28 46 28Z", "M38 28H40V100H38Z"],
    S: [93, "M91 31H55V27Q55 22 47 22Q39 22 39 28Q39 34 50 36L63 39Q94 44 94 70Q94 102 46 102Q0 102 0 69V64H37V71Q37 78 47 78Q56 78 56 72Q56 66 44 64L30 61Q0 56 0 30Q0-2 47-2Q91-2 91 27Z", "M40-2H42V29H40ZM51 73H53V102H51Z"],
    T: [91, "M0 0H91V33H65V100H27V33H0Z"],
    U: [94, "M0 0H38V66Q38 74 47 74Q56 74 56 66V0H94V68Q94 102 47 102Q0 102 0 68Z"],
    V: [96, "M0 0H39L49 60L58 0H97L75 100H22Z"],
    W: [136, "M0 0H37L43 55L54 0H82L94 55L100 0H136L119 100H81L68 49L55 100H17Z"],
    X: [96, "M0 0H39L48 26L58 0H96L71 49L97 100H57L48 74L38 100H0L25 49Z"],
    Y: [102, "M0 0H39L51 34L64 0H103L70 64V100H32V64Z"],
    Z: [86, "M0 0H86V27L43 70H86V100H0V72L43 30H0Z"],
    "0": [94, "M47-2Q94-2 94 40V60Q94 102 47 102Q0 102 0 60V40Q0-2 47-2ZM47 27Q37 27 37 39V61Q37 73 47 73Q57 73 57 61V39Q57 27 47 27Z", "M46 73H48V102H46Z"],
    "1": [56, "M0 14L24 0H54V100H17V35L0 42Z"],
    "2": [86, "M0 33Q0-2 43-2Q86-2 86 31Q86 48 67 63L48 77H86V100H0V74L41 40Q51 32 51 27Q51 22 44 22Q35 22 35 33Z"],
    "3": [85, "M0 28Q0-2 43-2Q84-2 84 27Q84 43 69 49Q85 54 85 72Q85 102 43 102Q0 102 0 71H34Q34 79 43 79Q51 79 51 69Q51 59 39 59H28V39H39Q50 39 50 29Q50 21 43 21Q35 21 35 28Z"],
    "4": [90, "M34 0H76V55H90V83H76V100H41V83H0V53ZM41 24L21 55H41Z"],
    "5": [86, "M3 0H83V27H35V39Q42 35 53 35Q87 35 87 69Q87 102 43 102Q0 102 0 72H35Q35 80 43 80Q52 80 52 68Q52 57 43 57Q36 57 33 62H0Z"],
    "6": [88, "M87 27H52Q51 21 44 21Q35 21 35 40Q43 35 55 35Q88 35 88 69Q88 102 44 102Q0 102 0 53Q0-2 45-2Q85-2 87 27ZM44 58Q35 58 35 69Q35 80 44 80Q53 80 53 69Q53 58 44 58Z"],
    "7": [82, "M0 0H82V25L49 100H10L44 30H0Z"],
    "8": [90, "M45-2Q88-2 88 27Q88 40 75 48Q90 54 90 73Q90 102 45 102Q0 102 0 73Q0 54 15 48Q2 40 2 27Q2-2 45-2ZM45 21Q37 21 37 30Q37 39 45 39Q53 39 53 30Q53 21 45 21ZM45 61Q36 61 36 70Q36 80 45 80Q54 80 54 70Q54 61 45 61Z"],
    "9": [88, "M1 73H36Q37 79 44 79Q53 79 53 60Q45 65 33 65Q0 65 0 31Q0-2 44-2Q88-2 88 47Q88 102 43 102Q3 102 1 73ZM44 20Q35 20 35 31Q35 42 44 42Q53 42 53 31Q53 20 44 20Z"],
    "-": [35, "M0 45H35V67H0Z"],
    ".": [27, "M0 73H27V100H0Z"],
    ":": [27, "M0 19H27V46H0ZM0 73H27V100H0Z"],
    "!": [35, "M0 0H35L30 66H5ZM3 75H32V100H3Z"],
    "'": [23, "M0 0H23L18 27H0Z"],
    "’": [23, "M0 0H23L18 27H0Z"],
    " ": [35, ""],
};
const paths = new Map();
function pathFor(d) {
    if (!paths.has(d))
        paths.set(d, new Path2D(d));
    return paths.get(d);
}
function advance(context, char) {
    if (glyphs[char])
        return glyphs[char][0];
    context.font = "900 100px 'PingFang SC', 'Arial Black', sans-serif";
    return context.measureText(char).width;
}
export function stencilWidth(context, text, tracking = 6) {
    const chars = Array.from(text.toUpperCase());
    return chars.reduce((sum, char) => sum + advance(context, char), 0) + Math.max(0, chars.length - 1) * tracking;
}
export function drawStencil(context, text, outline = false, tracking = 6) {
    context.save();
    for (const char of text.toUpperCase()) {
        const glyph = glyphs[char];
        if (glyph) {
            const [, shape, cut] = glyph;
            if (outline) {
                // Preserve the bridges as part of the outline, without painting a filled letter.
                context.lineWidth = 1.8;
                context.stroke(pathFor(shape));
                if (cut)
                    context.stroke(pathFor(cut));
            }
            else {
                context.fill(pathFor(shape), "evenodd");
                if (cut) {
                    context.save();
                    context.globalCompositeOperation = "destination-out";
                    context.fill(pathFor(cut));
                    context.restore();
                }
            }
        }
        else {
            context.font = "900 100px 'PingFang SC', 'Arial Black', sans-serif";
            if (outline)
                context.strokeText(char, 0, 86);
            else
                context.fillText(char, 0, 86);
        }
        context.translate(advance(context, char) + tracking, 0);
    }
    context.restore();
}
