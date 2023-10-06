CREATE TABLE IF NOT EXISTS authors(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    surname TEXT,
    pseudonym TEXT,
    nationality TEXT,
    birth INTEGER,
    death INTEGER,
    biography TEXT,
    img TEXT,
    rating INTEGER,
    path TEXT,
    idInJson TEXT,
    dtbkId TEXT,
    lgId TEXT,
    cbdbId TEXT
);

INSERT or IGNORE INTO authors VALUES (
    1,
    'Oscar',
    'Wilde',
    null,
    'irská',
    '1854',
    '1900',
    'Anglický dramatik, prozaik, básník a esejista irského původu. Narodil se 16. října 1854 v Dublinu jako syn Williama (přední irský oční a ušní chirurg) a Jane (úspěšná spisovatelka a irská nacionalistka, píšící pod jménem „Speranza“). Oscar Wilde studoval s výborným prospěchem klasickou filologii v Dublinu a na Oxfordu, kde začal psát verše a seznámil se s dekadentními názory, které na něho měly velký vliv. Stal se ústřední postavou hnutí dekadentů, proklamujících oslavu krásy a odmítajících spojení umění a morálky. Žil svobodně bez ohledu na konvence a pokryteckou morálku vyšších vrstev viktoriánské Anglie, vědomě šokoval prudérní společnost.<br><br>Dne 29. května 1884 se oženil s Constance Lloydovou, jejíž finanční zabezpečení mu umožnilo žít v relativním luxusu. Oscar Wilde byl citlivým a milujícím otcem dvou synů – Cyrila a Vyvyana. Od roku 1891 se datovalo Wildovo intimní přátelství s lordem Alfredem „Bosie“ Douglasem. Čtyři roky poté byl obžalován z homosexuality, která byla v Anglii od r. 1885 ilegální, a byl odsouzen na 2 roky těžkých nucených prací v Readingu.<br><br>Jeho žena Constance se od něj odvrátila a změnila sobě a synům příjmení na Hollandovi. Constance zemřela v roce 1898 v italském Janově, syn Cyril byl zabit během 1. světové války ve Francii. Vyvyan se stal spisovatelem a překladatelem a roku 1954 publikoval své paměti.<br><br>K nejslavnějším dílům tohoto autora patří jeho román Obraz Doriana Graye, drama Salome a dvě konverzační komedie Jak je důležité míti Filipa a Ideální manžel. Salome se stala tak úspěšnou, že se stala předlohou pro stejnojmennou operu R. Strausse.<br><br>Wilde psal také (mnohdy až andersenovsky laděné) pohádky. Za zmínku stojí i Wildeova báseň Balada o žaláři v Readingu, která vypovídá o vězení, kam byl Wilde odsouzen za své poklesky proti tehdejším mravům.<br><br>Oscar Wilde se po návratu z vězení potuloval po Evropě, převážně pobýval ve Francii. Zemřel 30. listopadu 1900 v bídě s podlomeným zdravím ve věku pouhých 46 let v Paříži.',
    'https://upload.wikimedia.org/wikipedia/commons/b/b1/Oscar_Wilde_by_Napoleon_Sarony_%281821-1896%29_Number_18.jpeg',
    null,
    '/ebook-library/Wilde, Oscar',
    null,
    null,
    null,
    null
);

CREATE TABLE IF NOT EXISTS books(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creatorId INTEGER,
    title TEXT,
    originalTitle TEXT,
    annotation TEXT,
    publisher TEXT,
    published INTEGER,
    genre TEXT,
    lenght INTEGER,
    language TEXT,
    translator TEXT,
    ISBN TEXT,
    path TEXT,
    progress TEXT,
    rating INTEGER,
    img TEXT,
    serie TEXT,
    serieOrder INTEGER,
    dtbkId TEXT,
    lgId TEXT,
    cbdbId TEXT,
    added TEXT,
    lastRead TEXT,
    finished TEXT
);

INSERT or IGNORE INTO books VALUES(
    1,
    1,
    'The Picture of Dorian Gray',
    'The Picture of Dorian Gray, 1891',
    'The Picture of Dorian Gray is a philosophical novel by Oscar Wilde. A shorter novella-length version was published in the July 1890 issue of the American periodical Lippincott''s Monthly Magazine. A revised and extended edition was published in April 1891. Revisions include changes in character dialogue as well as the addition of the preface, more scenes and chapters, and Sibyl Vane’s brother, James Vane. The story revolves around a portrait of Dorian Gray painted by Basil Hallward, a friend of Dorian''s and an artist infatuated with Dorian''s beauty. Through Basil, Dorian meets Lord Henry Wotton and is soon enthralled by the aristocrat''s hedonistic worldview: that beauty and sensual fulfillment are the only things worth pursuing in life. Newly understanding that his beauty will fade, Dorian expresses the desire to sell his soul, to ensure that the picture, rather than he, will age and fade. The wish is granted, and Dorian pursues a libertine life of varied amoral experiences while staying young and beautiful; all the while, his portrait ages and visually records every one of Dorian''s sins. Wilde''s only novel, it was subject to much controversy and criticism in its time but has come to be recognized as a classic of gothic literature',
    'THE PROJECT GUTENBERG',
    1994,
    'Philosophical fiction, decadent literature',
    272,
    'en-US',
    null,
    null,
    '/ebook-library/Wilde, Oscar/The Picture of Dorian Gray.epub',
    null,
    null,
    'https://upload.wikimedia.org/wikipedia/commons/0/00/The_title_card_of_an_1891_print_of_The_Picture_of_Dorian_Gray%2C_by_Oscar_Wilde.png',
    null,
    null,
    null,
    null,
    null,
    '2000-01-01 00:00:00.000',
    null,
    null
);

CREATE TABLE IF NOT EXISTS dbInfo(
    version INTEGER PRIMARY KEY
);

INSERT or IGNORE INTO dbInfo VALUES(
    8
);
