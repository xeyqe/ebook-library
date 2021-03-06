CREATE TABLE IF NOT EXISTS authors(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    surname TEXT,
    nationality TEXT,
    birth INTEGER,
    death INTEGER,
    biography TEXT,
    img TEXT,
    rating INTEGER,
    path TEXT,
    idInJson TEXT
);
INSERT or IGNORE INTO authors VALUES (
    1,
    'Oscar',
    'Wilde',
    'irská',
    '1854',
    '1900',
    'Anglický dramatik, prozaik, básník a esejista irského původu. Narodil se 16. října 1854 v Dublinu jako syn Williama (přední irský oční a ušní chirurg) a Jane (úspěšná spisovatelka a irská nacionalistka, píšící pod jménem „Speranza“). Oscar Wilde studoval s výborným prospěchem klasickou filologii v Dublinu a na Oxfordu, kde začal psát verše a seznámil se s dekadentními názory, které na něho měly velký vliv. Stal se ústřední postavou hnutí dekadentů, proklamujících oslavu krásy a odmítajících spojení umění a morálky. Žil svobodně bez ohledu na konvence a pokryteckou morálku vyšších vrstev viktoriánské Anglie, vědomě šokoval prudérní společnost.<br><br>Dne 29. května 1884 se oženil s Constance Lloydovou, jejíž finanční zabezpečení mu umožnilo žít v relativním luxusu. Oscar Wilde byl citlivým a milujícím otcem dvou synů – Cyrila a Vyvyana. Od roku 1891 se datovalo Wildovo intimní přátelství s lordem Alfredem „Bosie“ Douglasem. Čtyři roky poté byl obžalován z homosexuality, která byla v Anglii od r. 1885 ilegální, a byl odsouzen na 2 roky těžkých nucených prací v Readingu.<br><br>Jeho žena Constance se od něj odvrátila a změnila sobě a synům příjmení na Hollandovi. Constance zemřela v roce 1898 v italském Janově, syn Cyril byl zabit během 1. světové války ve Francii. Vyvyan se stal spisovatelem a překladatelem a roku 1954 publikoval své paměti.<br><br>K nejslavnějším dílům tohoto autora patří jeho román Obraz Doriana Graye, drama Salome a dvě konverzační komedie Jak je důležité míti Filipa a Ideální manžel. Salome se stala tak úspěšnou, že se stala předlohou pro stejnojmennou operu R. Strausse.<br><br>Wilde psal také (mnohdy až andersenovsky laděné) pohádky. Za zmínku stojí i Wildeova báseň Balada o žaláři v Readingu, která vypovídá o vězení, kam byl Wilde odsouzen za své poklesky proti tehdejším mravům.<br><br>Oscar Wilde se po návratu z vězení potuloval po Evropě, převážně pobýval ve Francii. Zemřel 30. listopadu 1900 v bídě s podlomeným zdravím ve věku pouhých 46 let v Paříži.',
    'https://upload.wikimedia.org/wikipedia/commons/b/b1/Oscar_Wilde_by_Napoleon_Sarony_%281821-1896%29_Number_18.jpeg',
    null,
    '/ebook-library/Wilde, Oscar/',
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
    img TEXT
);
INSERT or IGNORE INTO books VALUES(
    1,
    1,
    'Obraz Doriana Graye',
    'The Picture of Dorian Gray, 1891',
    'Příběh s fantastickými prvky se odehrává v 19. století v Londýně. Krásného Doriana Graye portrétuje malíř Basil Hallward, který je Dorianovým vzhledem uchvácen a naivně si myslí, že sličný mladík je a vždy bude ztělesněním dobra. Uzavřený malíř se přátelí s lordem Henrym, ten je povahově zcela jiný. V každé společnosti je Henry ozdobou, oslňuje hlubokomyslnými úvahami, nemá žádné morální zábrany. Na bohatého sirotka Doriana, původně stydlivého a nezkaženého mladíka, má Henry zničující vliv. Také před nadaným malířem rozpřádá neuctivé teorie o zbytečnosti portrétování. Portrétovaný člověk stárne, kdežto obraz zůstává nepříjemným svědectvím o ztraceném mládí. Doriana ta představa poleká natolik, že si přeje, aby místo něho zestárl jeho obraz. Tím, jak se ocitá plně pod Henryho vlivem a mění se jeho povaha, mění se portrét ve stvůru, která odráží ošklivost Dorianovy duše, avšak sám Dorian Gray nadále září půvabem a pelem mládí. Chová se už jako lord Henry. Pohrdne svou romantickou láskou, nezastaví se ani před zločinem. Nakonec zaútočí na podobiznu ohyzdného starce, ve kterou se původní portrét proměnil…',
    'Mladá fronta',
    1999,
    'Romány',
    248,
    'cs-CZ',
    'Jiří Zdeněk Novák',
    '80-204-0605-0',
    '/ebook-library/Wilde, Oscar/Obraz Doriana Graye.txt',
    null,
    null,
    'https://upload.wikimedia.org/wikipedia/commons/0/00/The_title_card_of_an_1891_print_of_The_Picture_of_Dorian_Gray%2C_by_Oscar_Wilde.png'
)