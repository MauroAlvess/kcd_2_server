/**
 * The texts of the `/book` demo, in the book movie's own markup.
 *
 * The chronicle tells the story of Kingdoms Connected as a monk of the
 * fifteenth century might have set it down, from what kingdomsconnected.com
 * and its changelog record. Each string is one page; the movie breaks after
 * every page but the last.
 */

/** Builds the chronicle; `seal` is what `Book.image` returned for the wax seal, or null when it could not be shipped. */
export function chroniclePages(seal: string | null): string[] {
    const sealImage = seal !== null ? `<img src='${seal}' width='220' height='220' align='center'/>` : "";

    return [
        "<title>The Chronicle of the Kingdoms Connected</title>" +
            "<subtitle>Being a True Account of how the Realm of Bohemia was made One for Many</subtitle>" +
            "<br/><br/><note>Set down by a humble brother of the scriptorium, in the year of Our Lord two thousand and twenty-six</note>",

        "<heading>Of the Lonely Realm</heading>" +
            "<paragraph><inc>I</inc>n the days before this chronicle, the realm of Bohemia was a lonely place: every traveller walked his own road, and no road crossed another.</paragraph>" +
            "<paragraph>Then a fellowship of craftsmen, the guild called <accent>MafiaHub</accent>, said: let the roads be crossed, and let every traveller see his neighbour.</paragraph>" +
            "<poem>Free to join.<br/>Community made.<br/>Yours to shape.</poem>",

        "<heading>Of the Great Muster</heading>" +
            "<paragraph><inc>T</inc>he halls were made wide enough to hold <accent>five hundred and twelve</accent> souls in one Bohemia, with merchants, horses, carts, chests with locks, and <accent>the same clock and the same sky</accent> for all.</paragraph>" +
            "<paragraph>The lord of every hall may write its laws himself, in JavaScript and TypeScript. Even this very book was so made, and sealed with wax from no candle.</paragraph>" +
            sealImage,

        "<heading>Of What is Yet to Come</heading>" +
            "<paragraph><inc>H</inc>ere the chronicle must end, for the work is not finished. This is a work of fans, freely given, and owes no fealty to Warhorse, to Deep Silver, nor to PLAION.</paragraph>" +
            "<note>Explicit liber. Thanks be to God.</note>",
    ];
}

/** A short herald's letter, to show the `letter` carrier. */
export function letterPages(): string[] {
    return [
        "<paragraph>To every traveller who reads this, greetings.</paragraph>" +
            "<paragraph>Know that the halls of the Kingdoms Connected stand open, and that five hundred and twelve may now ride together where once each rode alone. Bring thy horse, thy hound and thy sword, and keep thy purse close, for there are cutpurses abroad.</paragraph>" +
            "<paragraph>Given under our seal, at the month's end of September, in the year of Our Lord two thousand and twenty-six.</paragraph>" +
            "<note>The Heralds of the Kingdoms Connected</note>",
    ];
}
