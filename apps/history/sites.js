/* Sites today: a place as it stands now, opened from its card ("View the site"), from the Library (Sites) or from its pin on the map.
   The viewer covers the chart and leaves the card beside it. Its tabs:
     tours             a photo tour someone else hosts (a university, a ministry), walked point to point. Only ones that load in a frame.
     Outside, Inside   Google Street View, no key: the panorama nearest the point. A point inside a building finds the
                       indoor photos where someone took them. Photos by Google can be walked (arrows); visitors' photos are single 360s.
     scans             Sketchfab models made from photos (photogrammetry). Drag to turn, scroll to zoom, double-click a spot to go there.
   SITES: page id -> {name (when the page's own is an event, e.g. Taj Mahal begun), g: its group in the Library, out: [lat, lon, heading],
     in: [lat, lon, heading], scans: [{u: Sketchfab id, t: tab name}], tours: [{url, t, by: the credit}], note}.
     sv: more Street View points, [{t: tab name, p: [lat, lon, heading]}].
   TOURS: Columbia's Media Center for Art History panorama tours, [folder, name, group, lat, lon]; TK ties a tour to its page.
     A tour with a page joins that page's site; one without a page is a site of its own ("t:" + folder), on the map and in the Library.
   MORE: other hosts, [kind:id, site name, group, lat, lon, page id or "", tab name, photographer]. Rows with one site name make one site
     ("t:" + name when there is no page). Kinds in KIND below: walkable tours, CyArk's narrated 3D tours (their terms: free to embed with
     "Explore X on Tapestry by CyArk" shown), single 360 photos (after Street View) and Sketchfab scans. 360Cities was dropped: it refuses
     embeds on hmeyy.com. Test a new host from a page on hmeyy.com, not from localhost.
   Each point, scan and tour was checked by eye (26 and 27 Nov 2026). */
(() => {
const MCID = "https://mcid.mcah.columbia.edu/media/panos/pano-tours/", CU = "Photos: Media Center for Art History, Columbia University";
const AIR = "Photos: AirPano, from the air and on the ground.";
const GIZA = "Photos: the Giza Project at Harvard with Mused, about 2020 to 2022.";
const SITES = {
  "hagia-sophia":          { g: "Istanbul", out: [41.00740, 28.97895, 60], in: [41.00788, 28.97960, 60], scans: [{ u: "7e7d826a49d248a7a81d4129ce976420", t: "3D inside" }], year: 2021 },
  "colosseum":             { g: "Rome", out: [41.89127, 12.49145, 90], scans: [{ u: "544c64b6445e4899a17350c949b7766a", t: "3D" }],
                             tours: [{ url: "https://www.airpano.com/embed.php?3D=italy-rome-colosseum", t: "From the air", by: AIR }] },
  "taj-mahal-begun":       { name: "Taj Mahal", g: "India", out: [27.17330, 78.04210, 0],
                             tours: [{ url: "https://www.airpano.com/embed.php?3D=taj-mahal-india-2", t: "From the air", by: AIR }] },
  "angkor-wat-built":      { name: "Angkor Wat", out: [13.41090, 103.86400, 90], scans: [{ u: "86a97678ae6d4f41a14c13d77990f223", t: "3D" }], year: 2013 },
  "great-pyramid-of-giza": { g: "Egypt", out: [29.97730, 31.13250, 40], scans: [{ u: "4a251113722f4d969b6cf2ca5f35c502", t: "3D" }, { u: "aa5a8d05e15d4bc4becb6fcd88c5a35d", t: "Tomb of Idu" }],
                             tours: [{ url: "https://app.spacery.dev/s/0b7dabf2e410/great-pyramid-of-giza", t: "Walk inside", by: GIZA },
                                     { url: "https://app.spacery.dev/s/48a9f8d4fddb/the-tomb-of-queen-meresankh-iii-giza", t: "Tomb of Meresankh", by: GIZA },
                                     { url: "https://app.spacery.dev/s/5b073eb82f3f/the-great-sphinx-of-giza", t: "Sphinx", by: GIZA }] },
  "machu-picchu":          { g: "Peru", out: [-13.16310, -72.54500, 0], scans: [{ u: "eb2e2c36ba8a4d8197dc30dd947984d2", t: "3D" }],
                             tours: [{ url: "https://www.airpano.com/embed.php?3D=machu-picchu-peru", t: "From the air", by: AIR }] },
  "brihadisvara-temple":   { g: "South India", out: [10.78280, 79.13170, 270] },
  "charminar":             { g: "South India", in: [17.36160, 78.47470, 0] },
  "hampi":                 { sv: [{ t: "Virupaksha", p: [15.33520, 76.45870, 90] }, { t: "Vittala", p: [15.34230, 76.47510, 90] }] },
  "shore-temple":          { out: [12.61660, 80.19930, 90] },
  "t:Gangaikonda Cholapuram":   { name: "Gangaikonda Cholapuram", g: "South India", out: [11.20640, 79.44830, 90] },
  "t:Airavatesvara Temple":     { name: "Airavatesvara Temple, Darasuram", g: "South India", out: [10.94830, 79.35660, 90] },
  "t:Ramappa Temple":           { name: "Ramappa Temple", g: "South India", out: [18.25920, 79.94330, 270] },
  "t:Gol Gumbaz":               { name: "Gol Gumbaz", g: "South India", in: [16.83020, 75.73600, 0] },
  "t:Pattadakal":               { name: "Pattadakal", g: "South India", out: [15.95140, 75.81470, 20] },
  "t:Belur":                    { name: "Chennakeshava Temple, Belur", g: "South India", out: [13.16250, 75.86060, 90] },
  "t:Badami":                   { name: "Badami", g: "South India", out: [15.91830, 75.68420, 90] },
  "notre-dame-de-paris":   { out: [48.85300, 2.34900, 90], in: [48.85296, 2.35010, 90], scans: [{ u: "461a9a51ba1b40bc942b5dfa04c1100f", t: "3D" }],
                             note: "The walk and the 3D scan were made before the 2019 fire." },
};
const TOURS = [
  ["IDP/Arap-Camii", "Arap Mosque", "Istanbul", 41.0243, 28.971],
  ["IDP/Atik-Ali-Pasa-Camii", "Atik Ali Pasha Mosque", "Istanbul", 41.0083, 28.9712],
  ["IDP/Atik-Mustafa-Pasa-Camii", "Atik Mustafa Pasha Mosque", "Istanbul", 41.0386, 28.944],
  ["IDP/Aya-Triada", "Hagia Triada Church", "Istanbul", 41.0355, 28.9842],
  ["IDP/Basilica-Cistern", "Basilica Cistern", "Istanbul", 41.0081, 28.9778],
  ["IDP/Bebek-Camii", "Bebek Mosque", "Istanbul", 41.0768, 29.0441],
  ["IDP/Beylerbeyi-Camii", "Beylerbeyi Mosque", "Istanbul", 41.0451, 29.0458],
  ["IDP/Bodrum-Camii-Myrelaion-Monastery", "Myrelaion (Bodrum Mosque)", "Istanbul", 41.0086, 28.9556],
  ["IDP/Cerrahpasa-Camii", "Cerrahpaşa Mosque", "Istanbul", 41.0035, 28.9395],
  ["IDP/Cihangir-Camii", "Cihangir Mosque", "Istanbul", 41.0331, 28.9853],
  ["IDP/Dolmabahce-Camii", "Dolmabahçe Mosque", "Istanbul", 41.0367, 28.9953],
  ["IDP/Eski-Camii", "Old Mosque", "Edirne and Thrace", 41.6767, 26.5557],
  ["IDP/Eski-Imaret-Camii", "Eski Imaret Mosque", "Istanbul", 41.0217, 28.955],
  ["IDP/Eyup-Sultan-Camii", "Eyüp Sultan Mosque", "Istanbul", 41.0479, 28.9338],
  ["IDP/Faith-Camii", "Fatih Mosque", "Istanbul", 41.0197, 28.9497],
  ["IDP/Fethiye-Camii-Pammakaristos-Church", "Pammakaristos Church", "Istanbul", 41.0292, 28.9464],
  ["IDP/Gul-Camii", "Gül Mosque", "Istanbul", 41.0267, 28.9565],
  ["IDP/Hadim-Ibrahim-Pasa-Camii", "Hadım İbrahim Pasha Mosque", "Istanbul", 41.0045, 28.923],
  ["IDP/Hagia-Sophia", "Hagia Sophia", "Istanbul", 41.0083, 28.98],
  ["IDP/Haseki-Sultan-Camii", "Haseki Sultan Mosque", "Istanbul", 41.0086, 28.9418],
  ["IDP/Hekim-Oglu-Ali-Camii", "Hekimoğlu Ali Pasha Mosque", "Istanbul", 41.0062, 28.935],
  ["IDP/Ivaz-Efendi-Camii", "İvaz Efendi Mosque", "Istanbul", 41.0385, 28.9408],
  ["IDP/Kalenderhane-Camii", "Kalenderhane Mosque", "Istanbul", 41.0131, 28.9603],
  ["IDP/Kariye-Camii", "Chora Church", "Istanbul", 41.0312, 28.939],
  ["IDP/Kefeli-Mescidi", "Kefeli Mosque", "Istanbul", 41.0294, 28.9417],
  ["IDP/Kilic-Ali-Pasa-Camii", "Kılıç Ali Pasha Mosque", "Istanbul", 41.0264, 28.9809],
  ["IDP/Koca-Mustafa-Pasa-Camii", "Koca Mustafa Pasha Mosque", "Istanbul", 41.0034, 28.9286],
  ["IDP/Kucuk-Ayasofya-Camii", "Little Hagia Sophia", "Istanbul", 41.0028, 28.9719],
  ["IDP/Laleli-Camii", "Laleli Mosque", "Istanbul", 41.01, 28.9567],
  ["IDP/Mesih-Mehmet-Pasa-Camii", "Mesih Mehmed Pasha Mosque", "Istanbul", 41.0219, 28.9434],
  ["IDP/Mihrimah-Sultan-Camii", "Mihrimah Sultan Mosque", "Istanbul", 41.029, 28.933],
  ["IDP/Muradiye-Camii", "Muradiye Mosque", "Edirne and Thrace", 41.6824, 26.5648],
  ["IDP/Nisanci-Mehmet-Pasa-Camii", "Nişancı Mehmed Pasha Mosque", "Istanbul", 41.0242, 28.9447],
  ["IDP/Nuruosmaniye-Camii", "Nuruosmaniye Mosque", "Istanbul", 41.0102, 28.9705],
  ["IDP/Ortakoy-Buyuk-Mecidiye-Camii", "Ortaköy Mosque", "Istanbul", 41.0469, 29.0269],
  ["IDP/Piyalepasa-Camii", "Piyale Pasha Mosque", "Istanbul", 41.0466, 28.966],
  ["IDP/Rustem-Pasa-Camii", "Rüstem Pasha Mosque", "Istanbul", 41.0175, 28.9686],
  ["IDP/Sancaktar-Hayrettin-Mescidi", "Sancaktar Hayrettin Mosque", "Istanbul", 41.0027, 28.9347],
  ["IDP/Sehzade-Camii", "Şehzade Mosque", "Istanbul", 41.0138, 28.9572],
  ["IDP/Selimiye-Camii", "Selimiye Mosque", "Edirne and Thrace", 41.6777, 26.5594],
  ["IDP/Sinan-Pasa-Camii", "Sinan Pasha Mosque", "Istanbul", 41.0423, 29.0062],
  ["IDP/Sokullu-Mehmed-Pasa-Camii", "Sokollu Mehmed Pasha Mosque", "Istanbul", 41.005, 28.972],
  ["IDP/Suleymaniye-Camii", "Süleymaniye Mosque", "Istanbul", 41.0161, 28.9639],
  ["IDP/Sultan-Selim-Camii", "Yavuz Selim Mosque", "Istanbul", 41.0266, 28.9513],
  ["IDP/Sultanahmet-Camii", "Blue Mosque", "Istanbul", 41.0054, 28.9768],
  ["IDP/Uc-Serefeli-Camii", "Üç Şerefeli Mosque", "Edirne and Thrace", 41.6774, 26.5551],
  ["IDP/Vefa-Kilise-Camii", "Vefa Kilise Mosque", "Istanbul", 41.0164, 28.9603],
  ["IDP/Vize-Camii", "Hagia Sophia of Vize", "Edirne and Thrace", 41.5728, 27.7652],
  ["IDP/Yeni-Valide-Camii", "Yeni Valide Mosque", "Istanbul", 41.0248, 29.0151],
  ["IDP/Zeyrek-Kilise-Camii", "Pantokrator Monastery (Zeyrek Mosque)", "Istanbul", 41.0197, 28.9572],
  ["Angkor/Angkor-Wat", "Angkor Wat", "Angkor", 13.4125, 103.8667],
  ["Angkor/Bakong", "Bakong", "Angkor", 13.336, 103.9741],
  ["Angkor/Banteay-Samre", "Banteay Samré", "Angkor", 13.4422, 103.9592],
  ["Angkor/Banteay-Srei", "Banteay Srei", "Angkor", 13.5989, 103.9628],
  ["Angkor/Lolei", "Lolei", "Angkor", 13.3528, 103.9739],
  ["Angkor/Preah-Ko", "Preah Ko", "Angkor", 13.3439, 103.9728],
  ["Andean/Chan-Chan", "Chan Chan", "Peru", -8.1058, -79.0744],
  ["Andean/Silustani", "Sillustani", "Peru", -15.7211, -70.1583],
  ["Rome/Basilica-of-San-Clemente", "San Clemente", "Rome", 41.8894, 12.4975],
  ["Rome/Baths-of-Caracalla", "Baths of Caracalla", "Rome", 41.8794, 12.4931],
  ["Rome/Campidoglio", "Piazza del Campidoglio", "Rome", 41.8933, 12.4828],
  ["Rome/Gianicolense-Mausoleum-Monument", "Garibaldi Ossuary on the Janiculum", "Rome", 41.8885, 12.4655],
  ["Rome/Lateran-Basilica-and-Baptistery", "Lateran Basilica and Baptistery", "Rome", 41.8859, 12.5062],
  ["Rome/Ospedale-Santo-Spirito", "Santo Spirito Hospital", "Rome", 41.9014, 12.4611],
  ["Rome/Palazzo-Baldassini", "Palazzo Baldassini", "Rome", 41.9006, 12.4756],
  ["Rome/Palazzo-Borghese", "Palazzo Borghese", "Rome", 41.9039, 12.4764],
  ["Rome/Palazzo-Gaddi", "Palazzo Gaddi", "Rome", 41.8995, 12.4672],
  ["Rome/Palazzo-Mattei", "Palazzo Mattei", "Rome", 41.894, 12.4782],
  ["Rome/Palazzo-Spada", "Palazzo Spada", "Rome", 41.894, 12.4718],
  ["Rome/Palazzo-della-Valle", "Palazzo della Valle", "Rome", 41.8963, 12.4747],
  ["Rome/Pantheon", "Pantheon", "Rome", 41.8986, 12.4768],
  ["Rome/Piazza-Navona", "Piazza Navona", "Rome", 41.899, 12.4731],
  ["Rome/Porta-Maggiore", "Porta Maggiore", "Rome", 41.8915, 12.5152],
  ["Rome/Porta-Pia", "Porta Pia", "Rome", 41.9092, 12.5011],
  ["Rome/SS-Cosma-e-Damiano", "Santi Cosma e Damiano", "Rome", 41.8922, 12.4875],
  ["Rome/San%27t-Eligio-degli-Orefici", "Sant'Eligio degli Orefici", "Rome", 41.8957, 12.468],
  ["Rome/San-Carlo", "San Carlo alle Quattro Fontane", "Rome", 41.9018, 12.4907],
  ["Rome/San-Crisogono", "San Crisogono", "Rome", 41.8891, 12.4737],
  ["Rome/San-Giacomo-degli-Spagnoli", "San Giacomo degli Spagnoli", "Rome", 41.8983, 12.4735],
  ["Rome/San-Lorenzo-fuori-le-Mura", "San Lorenzo fuori le Mura", "Rome", 41.9025, 12.5206],
  ["Rome/San-Marco", "San Marco", "Rome", 41.8957, 12.4814],
  ["Rome/San-Nicola-in-Carcere", "San Nicola in Carcere", "Rome", 41.8911, 12.48],
  ["Rome/San-Pietro-Montorio", "San Pietro in Montorio and the Tempietto", "Rome", 41.8886, 12.4666],
  ["Rome/Sant%27Agnese-in-Agone", "Sant'Agnese in Agone", "Rome", 41.8988, 12.4726],
  ["Rome/Sant-Agostino", "Sant'Agostino", "Rome", 41.9008, 12.4742],
  ["Rome/Sant-Andrea", "Sant'Andrea al Quirinale", "Rome", 41.9007, 12.4893],
  ["Rome/Santa-Costanza", "Santa Costanza", "Rome", 41.9226, 12.5174],
  ["Rome/Santa-Maria-Aracoeli", "Santa Maria in Aracoeli", "Rome", 41.8939, 12.4833],
  ["Rome/Santa-Maria-degli-Angeli", "Santa Maria degli Angeli", "Rome", 41.9031, 12.4969],
  ["Rome/Santa-Maria-della-Pace", "Santa Maria della Pace", "Rome", 41.8999, 12.4716],
  ["Rome/Santa-Maria-in-Cosmedin", "Santa Maria in Cosmedin", "Rome", 41.8881, 12.4817],
  ["Rome/Santa-Maria-in-Trastevere", "Santa Maria in Trastevere", "Rome", 41.8894, 12.4697],
  ["Rome/Santa-Prassede", "Santa Prassede", "Rome", 41.8961, 12.4986],
  ["Rome/Santi-Giovanni-e-Paolo", "Santi Giovanni e Paolo", "Rome", 41.8863, 12.4923],
  ["Rome/Santi-Quattro-Coronati", "Santi Quattro Coronati", "Rome", 41.8883, 12.4983],
  ["Rome/Santo-Stefano-Rotundo", "Santo Stefano Rotondo", "Rome", 41.8845, 12.4968],
  ["Rome/Villa-Lante", "Villa Lante", "Rome", 41.8931, 12.4607],
  ["Jordan/Amman-Citadel", "Amman Citadel", "Jordan", 31.9545, 35.9349],
  ["Jordan/Amman-Nymphaeum", "Amman Nymphaeum", "Jordan", 31.9503, 35.9362],
  ["Jordan/Jerash", "Jerash", "Jordan", 32.2806, 35.8972],
  ["Jordan/Petra", "Petra", "Jordan", 30.3285, 35.4444],
  ["Jordan/Qasr-Amra", "Qusayr Amra", "Jordan", 31.8017, 36.5873],
  ["Jordan/Qasr-Kharana", "Qasr Kharana", "Jordan", 31.7289, 36.4628],
  ["Jordan/Qasr-Mshatta", "Mshatta Palace", "Jordan", 31.7375, 36.0103],
  ["Qutb/Fatima-Sultana", "Tomb of Fatima Sultana", "South India", 17.395, 78.396],
  ["Qutb/Hyath-Bakshi-Begum", "Tomb of Hayat Bakshi Begum", "South India", 17.395, 78.396],
  ["Qutb/Mohammed-Quli-Qutb-Shah", "Tomb of Muhammad Quli Qutb Shah", "South India", 17.395, 78.396],
  ["Qutb/Mohammed-Qutb-Shah", "Tomb of Muhammad Qutb Shah", "South India", 17.395, 78.396],
  ["Japan/Byodo-in", "Byōdō-in", "Japan", 34.8894, 135.8078],
  ["Japan/Ginkakuji", "Ginkaku-ji", "Japan", 35.0267, 135.7983],
  ["Japan/Himeji-Castle", "Himeji Castle", "Japan", 34.8394, 134.6939],
  ["Japan/Jiyu-Gakuen", "Jiyu Gakuen Myonichikan", "Japan", 35.7264, 139.7069],
  ["Japan/Kiyomizudera", "Kiyomizu-dera", "Japan", 34.995, 135.785],
  ["Japan/Kofukuji", "Kōfuku-ji", "Japan", 34.6833, 135.8312],
  ["Japan/Muroji", "Murō-ji", "Japan", 34.5379, 136.0406],
  ["Japan/Nijo-Castle", "Nijō Castle", "Japan", 35.0142, 135.7475],
  ["Japan/Ryoanji", "Ryōan-ji", "Japan", 35.0344, 135.7183],
  ["Japan/St-Marys-Cathedral", "St. Mary's Cathedral", "Japan", 35.7142, 139.7267],
  ["Japan/To-ji", "Tō-ji", "Japan", 34.9806, 135.7478],
  ["Japan/Todaiji", "Tōdai-ji", "Japan", 34.6892, 135.8397],
  ["Japan/Yakushiji", "Yakushi-ji", "Japan", 34.6684, 135.7843],
  ["Venice/Basilica_San_Marco", "St Mark's Basilica", "Venice", 45.4344, 12.3397],
  ["Venice/Biblioteca_Nazionale_Marciana", "Marciana Library", "Venice", 45.4333, 12.3392],
  ["Venice/Ca_d_Oro", "Ca' d'Oro", "Venice", 45.4406, 12.3339],
  ["Venice/Campo-S-Margherita", "Campo Santa Margherita", "Venice", 45.4344, 12.3238],
  ["Venice/Campo-S-Stefano", "Campo Santo Stefano", "Venice", 45.4331, 12.3302],
  ["Venice/Campo-SM-Formosa", "Campo Santa Maria Formosa", "Venice", 45.4375, 12.3408],
  ["Venice/Chiesa_del_Santissimo_Redentore", "Il Redentore", "Venice", 45.425, 12.3325],
  ["Venice/CityTour", "A walk through Venice", "Venice", 45.4375, 12.3358],
  ["Venice/Palazzo_Ducale", "Doge's Palace", "Venice", 45.4337, 12.3405],
  ["Venice/Piazza_San_Marco", "Piazza San Marco", "Venice", 45.4339, 12.3381],
  ["Venice/Rialto", "Rialto", "Venice", 45.438, 12.336],
  ["Venice/San_Felice", "San Felice", "Venice", 45.4417, 12.3333],
  ["Venice/San_Giacomo_dall_Orio", "San Giacomo dall'Orio", "Venice", 45.4401, 12.3274],
  ["Venice/San_Giobbe", "San Giobbe", "Venice", 45.445, 12.3203],
  ["Venice/San_Giorgio_Maggiore", "San Giorgio Maggiore", "Venice", 45.428, 12.3442],
  ["Venice/San_Giovanni_Battista_in_Bragora", "San Giovanni in Bragora", "Venice", 45.4344, 12.347],
  ["Venice/San_Giovanni_Crisostomo", "San Giovanni Grisostomo", "Venice", 45.4392, 12.3372],
  ["Venice/San_Michele_in_Isola", "San Michele in Isola", "Venice", 45.4491, 12.347],
  ["Venice/San_Pietro_di_Castello", "San Pietro di Castello", "Venice", 45.4345, 12.3599],
  ["Venice/San_Salvadore", "San Salvador", "Venice", 45.4366, 12.3365],
  ["Venice/San_Sebastiano", "San Sebastiano", "Venice", 45.432, 12.32],
  ["Venice/San_Zaccaria", "San Zaccaria", "Venice", 45.4347, 12.3433],
  ["Venice/Santa_Fosca", "Santa Fosca, Torcello", "Venice", 45.4977, 12.418],
  ["Venice/Santa_Maria_Assunta", "Torcello Cathedral", "Venice", 45.4982, 12.4193],
  ["Venice/Santa_Maria_Formosa", "Santa Maria Formosa", "Venice", 45.4369, 12.3411],
  ["Venice/Santa_Maria_Gloriosa_dei_Frari", "Santa Maria Gloriosa dei Frari", "Venice", 45.4367, 12.3261],
  ["Venice/Santa_Maria_dei_Carmini", "Santa Maria dei Carmini", "Venice", 45.4332, 12.3225],
  ["Venice/Santa_Maria_dei_Miracoli", "Santa Maria dei Miracoli", "Venice", 45.4394, 12.3392],
  ["Venice/Santa_Maria_della_Salute", "Santa Maria della Salute", "Venice", 45.4308, 12.3344],
  ["Venice/Santi_Apostoli", "Santi Apostoli", "Venice", 45.4405, 12.3366],
  ["Venice/Santi_Giovanni_e_Paolo", "Santi Giovanni e Paolo", "Venice", 45.4392, 12.3421],
  ["Venice/Santo_Stefano", "Santo Stefano", "Venice", 45.4332, 12.3302],
  ["Venice/Scuola-Grande-di-San-Rocco", "Scuola Grande di San Rocco", "Venice", 45.4366, 12.325],
  ["Venice/Scuola_Grande_della_Misericordia", "Scuola Grande della Misericordia", "Venice", 45.4436, 12.3347],
  ["Venice/Scuola_Grande_di_San_Marco", "Scuola Grande di San Marco", "Venice", 45.4397, 12.3414],
  ["Venice/Scuola_di_San_Giovanni_Evangelista", "Scuola Grande di San Giovanni Evangelista", "Venice", 45.438, 12.326],
  ["Puglia/Basilica-Cattedrale-della-Visitazione-e-San-Giovanni-Battista", "Altamura Cathedral", "Puglia", 40.8274, 16.5531],
  ["Puglia/Basilica-Cattedrale-di-Maria-SS-Assunta", "Trani Cathedral", "Puglia", 41.2822, 16.4184],
  ["Puglia/Basilica-Cattedrale-di-San-Sabino", "Bari Cathedral", "Puglia", 41.1285, 16.8689],
  ["Puglia/Basilica-Cattedrale-di-Sant-Agata", "Gallipoli Cathedral", "Puglia", 40.0547, 17.9761],
  ["Puglia/Concattedrale-di-Maria-SS-Assunta", "Bitonto Cathedral", "Puglia", 41.1064, 16.69],
  ["Other/Ostia", "Ostia Antica", "Around Rome", 41.7558, 12.2917],
  ["Other/Palazzo-Ducale-di-Urbino", "Ducal Palace, Urbino", "Urbino and Milan", 43.7233, 12.6378],
  ["Other/Panamarca", "Pañamarca", "Peru", -9.2089, -78.3728],
  ["Other/San-Bernardino", "San Bernardino, Urbino", "Urbino and Milan", 43.718, 12.629],
  ["Other/San-Miniato-al-Monte", "San Miniato al Monte", "Florence", 43.7598, 11.2647],
  ["Other/San-Nazaro-in-Brolo", "San Nazaro in Brolo, Milan", "Urbino and Milan", 45.4586, 9.1925],
  ["Other/San-Remigio", "San Remigio", "Florence", 43.7684, 11.258],
  ["Other/San-Salvatore-al-Monte", "San Salvatore al Monte", "Florence", 43.7615, 11.2655],
  ["Other/Sanctuary-Hercules", "Sanctuary of Hercules Victor", "Around Rome", 41.9606, 12.7953],
  ["Other/Santa-Maria-del-Carmine", "Santa Maria del Carmine", "Florence", 43.768, 11.2439],
  ["Other/Santa-Maria-del-Popolo", "Santa Maria del Popolo", "Rome", 41.9114, 12.4764],
  ["Other/Santi-Apostoli-di-Firenze", "Santi Apostoli", "Florence", 43.7693, 11.2523],
  ["Other/Villa-Adriana", "Hadrian's Villa", "Around Rome", 41.946, 12.7725],
  ["Southwest/Bandelier", "Bandelier", "American Southwest", 35.7789, -106.3211],
  ["Southwest/Chaco-Canyon", "Chaco Canyon", "American Southwest", 36.06, -107.96],
  ["Southwest/Hubble-Trading-Post", "Hubbell Trading Post", "American Southwest", 35.7239, -109.56],
  ["Southwest/Mesa-Verde", "Mesa Verde", "American Southwest", 37.1838, -108.4887],
  ["Southwest/Mission-San-Gregorio-de-Abo", "Mission of San Gregorio de Abó", "American Southwest", 34.4497, -106.3767],
  ["Southwest/Santuario-de-Chimayo", "Santuario de Chimayó", "American Southwest", 35.9897, -105.9272],
  ["Paris-Notre-Dame", "Notre-Dame de Paris", "Paris", 48.8531, 2.35],
];
/* tour folder -> page id */
const TK = {
  "IDP/Hagia-Sophia": "hagia-sophia", "Angkor/Angkor-Wat": "angkor-wat-built", "Paris-Notre-Dame": "notre-dame-de-paris",
  "IDP/Basilica-Cistern": "basilica-cistern", "IDP/Suleymaniye-Camii": "suleymaniye-mosque", "IDP/Kucuk-Ayasofya-Camii": "little-hagia-sophia",
  "IDP/Kariye-Camii": "chora-church-rebuilt", "IDP/Zeyrek-Kilise-Camii": "pantokrator-monastery", "IDP/Sultanahmet-Camii": "blue-mosque",
  "IDP/Selimiye-Camii": "selimiye-mosque", "IDP/Faith-Camii": "fatih-mosque", "IDP/Rustem-Pasa-Camii": "rustem-pasha-mosque",
  "IDP/Mihrimah-Sultan-Camii": "mihrimah-sultan-mosque", "IDP/Sehzade-Camii": "sehzade-mosque", "IDP/Fethiye-Camii-Pammakaristos-Church": "pammakaristos-church",
  "IDP/Nuruosmaniye-Camii": "nuruosmaniye-mosque", "IDP/Eyup-Sultan-Camii": "eyup-sultan-mosque",
  "Angkor/Banteay-Srei": "banteay-srei", "Angkor/Bakong": "bakong", "Andean/Chan-Chan": "chan-chan", "Andean/Silustani": "sillustani",
  "Rome/Baths-of-Caracalla": "baths-of-caracalla", "Rome/Pantheon": "pantheon-rebuilt", "Rome/Basilica-of-San-Clemente": "basilica-of-san-clemente",
  "Rome/Lateran-Basilica-and-Baptistery": "archbasilica-of-saint-john-lateran", "Rome/Santa-Costanza": "santa-costanza",
  "Rome/Santa-Maria-in-Trastevere": "santa-maria-in-trastevere", "Rome/Santa-Prassede": "santa-prassede", "Rome/Santa-Maria-in-Cosmedin": "santa-maria-in-cosmedin",
  "Rome/Santo-Stefano-Rotundo": "santo-stefano-rotondo", "Rome/Campidoglio": "piazza-del-campidoglio", "Rome/Piazza-Navona": "piazza-navona",
  "Rome/San-Carlo": "san-carlo-alle-quattro-fontane", "Rome/Sant-Andrea": "sant-andrea-al-quirinale", "Rome/San-Pietro-Montorio": "san-pietro-in-montorio",
  "Other/Santa-Maria-del-Popolo": "santa-maria-del-popolo", "Other/Villa-Adriana": "hadrians-villa", "Other/Ostia": "ostia-antica",
  "Jordan/Jerash": "jerash", "Jordan/Petra": "petra", "Jordan/Qasr-Amra": "qusayr-amra", "Jordan/Amman-Citadel": "amman-citadel", "Jordan/Qasr-Mshatta": "mshatta-palace",
  "Qutb/Mohammed-Quli-Qutb-Shah": "qutb-shahi-tombs",
  "Japan/Himeji-Castle": "himeji-castle", "Japan/Todaiji": "todai-ji-great-buddha", "Japan/Kiyomizudera": "kiyomizu-dera", "Japan/Byodo-in": "byodo-in",
  "Japan/Ryoanji": "ryoan-ji", "Japan/Ginkakuji": "ginkaku-ji", "Japan/Nijo-Castle": "nijo-castle", "Japan/Kofukuji": "kofuku-ji", "Japan/Yakushiji": "yakushi-ji",
  "Venice/Basilica_San_Marco": "st-marks-basilica", "Venice/Palazzo_Ducale": "doges-palace", "Venice/Piazza_San_Marco": "piazza-san-marco",
  "Venice/Rialto": "rialto-bridge", "Venice/Santa_Maria_Gloriosa_dei_Frari": "frari", "Venice/Santa_Maria_della_Salute": "santa-maria-della-salute",
  "Venice/Scuola-Grande-di-San-Rocco": "scuola-grande-di-san-rocco", "Venice/San_Giorgio_Maggiore": "san-giorgio-maggiore",
  "Venice/Santa_Maria_Assunta": "torcello-cathedral", "Venice/Ca_d_Oro": "ca-d-oro", "Venice/Chiesa_del_Santissimo_Redentore": "il-redentore",
  "Other/Palazzo-Ducale-di-Urbino": "ducal-palace-urbino", "Other/San-Miniato-al-Monte": "san-miniato-al-monte",
  "Southwest/Mesa-Verde": "cliff-palace-mesa-verde", "Southwest/Chaco-Canyon": "chaco-canyon", "Southwest/Bandelier": "bandelier-national-monument",
};
/* every tour joins its page's site, or stands as a site of its own */
const MORE = [
  ["S:9540f3ac06a5/walking-the-giza-plateau-egypt", "Great Pyramid of Giza", "Egypt", 29.97611, 31.13278, "great-pyramid-of-giza", "Giza plateau"],
  ["S:711262153bb3/the-great-sphinx-giza", "Great Sphinx", "Egypt", 29.97526, 31.13758, "great-sphinx-of-giza", "Walk through"],
  ["S:4e4ce023e3eb/the-tomb-of-khufukhaf-i-giza", "Tombs at Giza", "Egypt", 29.9776, 31.1361, "", "Khufukhaf I"],
  ["S:2e5bb8fb3b84/tomb-of-neferbauptah-giza", "Tombs at Giza", "Egypt", 29.9776, 31.1361, "", "Neferbauptah"],
  ["S:da459a32687f/tomb-of-iasen-giza", "Tombs at Giza", "Egypt", 29.9776, 31.1361, "", "Iasen"],
  ["S:e824d12857b6/the-pyramid-of-unas-saqqara", "Pyramid of Unas", "Egypt", 29.86833, 31.21472, "", "Walk through"],
  ["S:3d80fdf4022f/the-step-pyramid-of-djoser-saqqara", "Step Pyramid of Djoser", "Egypt", 29.8711, 31.2167, "", "Walk through"],
  ["S:6b4ed2f64b75/inside-and-around-the-step-pyramid-of-djoser-saqqara", "Step Pyramid of Djoser", "Egypt", 29.8711, 31.2167, "", "Inside and around"],
  ["M:xmDbt2rfa82", "Tombs at Saqqara", "Egypt", 29.8697, 31.2155, "", "Mehu"],
  ["M:PKxweZaPG3P", "Tombs at Saqqara", "Egypt", 29.8697, 31.2155, "", "Niankhkhnum and Khnumhotep"],
  ["M:BsXpwTSYSyN", "Tombs at Saqqara", "Egypt", 29.8697, 31.2155, "", "Wahtye"],
  ["S:4ac7c19df36c/the-mosque-of-muhammad-ali-cairo-citadel", "Mosque of Muhammad Ali", "Egypt", 30.02861, 31.25972, "", "Walk through"],
  ["M:CqL3QB3dh7N", "Mosque of Muhammad Ali", "Egypt", 30.02861, 31.25972, "", "3D walk"],
  ["S:7af83603df37/bab-zuwayla-cairo", "Bab Zuwayla", "Egypt", 30.04283, 31.2578, "", "Walk through"],
  ["M:qhjXLPRDvRw", "Al-Fath Mosque", "Egypt", 30.05985, 31.24606, "", "3D walk"],
  ["M:LCyv1zFUxiq", "Gayer-Anderson House", "Egypt", 30.0284, 31.2507, "", "3D walk"],
  ["M:PfNu1RDRbZf", "Abu Serga Church", "Egypt", 30.0059, 31.2304, "", "3D walk"],
  ["S:405effeb1519/the-villa-of-the-birds-alexandria", "Villa of the Birds, Alexandria", "Egypt", 31.19669, 29.90564, "", "Walk through"],
  ["S:72da2138035b/qaitbay-citadel-alexandria", "Citadel of Qaitbay", "Egypt", 31.213, 29.8852, "", "Walk through"],
  ["S:86acf94c40cf/saint-catherine-s-monastery-sinai", "Saint Catherine's Monastery", "Egypt", 28.55556, 33.97611, "", "Monastery"],
  ["S:ddb9c80334cf/the-museum-saint-catherine-s-monastery-sinai", "Saint Catherine's Monastery", "Egypt", 28.55556, 33.97611, "", "Museum"],
  ["S:0f65715f71e9/mount-sinai-holy-summit", "Saint Catherine's Monastery", "Egypt", 28.55556, 33.97611, "", "Summit of Mount Sinai"],
  ["S:05d77725997a/chapel-at-saint-anthony-s-monastery", "Monastery of Saint Anthony", "Egypt", 28.9244, 32.3486, "", "Walk through"],
  ["S:d5648deebaee/osireion-temple-of-seti-i-abydos", "Abydos", "Egypt", 26.185, 31.91889, "", "Seti I and the Osireion"],
  ["S:bb9fcbb0574f/the-temple-of-ramesses-ii-abydos", "Abydos", "Egypt", 26.185, 31.91889, "", "Ramesses II"],
  ["S:8d79d291ddc7/karnak-temple-complex-egypt", "Karnak", "Egypt", 25.7183, 32.6583, "karnak", "Walk through"],
  ["S:33a0cb970e79/luxor-temple", "Luxor Temple", "Egypt", 25.7, 32.63917, "", "By day"],
  ["S:b0eb64790078/luxor-temple-night", "Luxor Temple", "Egypt", 25.7, 32.63917, "", "By night"],
  ["S:79975b05067d/mortuary-temple-of-hatshepsut", "Temple of Hatshepsut", "Egypt", 25.73828, 32.60658, "", "Walk through"],
  ["S:280428e56ee0/medinet-habu-temple", "Medinet Habu", "Egypt", 25.71972, 32.60083, "", "Walk through"],
  ["S:4ee9faeb51a8/the-tomb-of-menna-valley-of-the-nobles", "Tomb of Menna", "Egypt", 25.7333, 32.6, "", "Walk through"],
  ["S:fbb9de0b7dc6/the-valley-of-the-kings-luxor-egypt", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "The valley"],
  ["S:d12c56b4e0b8/the-tomb-of-tutankhamun-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Tutankhamun"],
  ["S:a301b2fdabb1/tomb-of-seti-i-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Seti I"],
  ["S:56658c81e687/the-tomb-of-ramesses-ii-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Ramesses II"],
  ["S:6c75f88e5f48/the-tomb-of-ramesses-i", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Ramesses I"],
  ["S:326a0d2a3bda/the-tomb-of-ramesses-iii-kv-11-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Ramesses III"],
  ["S:30a3256af0a2/tomb-of-ramesses-v-and-vi-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Ramesses V and VI"],
  ["S:12c9a4d57a54/the-tomb-of-merenptah-kv-8-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Merenptah"],
  ["S:2a6ee4078eba/the-tomb-of-tausert-and-setnakht-kv-14-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Tausert and Setnakht"],
  ["S:8a70fb43e144/the-tomb-of-thutmose-iii-kv-34-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Thutmose III"],
  ["S:274613b6fd28/tomb-of-thutmose-iv-valley-of-the-kings", "Valley of the Kings", "Egypt", 25.74083, 32.60222, "", "Thutmose IV"],
  ["S:d0967aa95a9f/the-valley-of-the-queens-luxor-egypt", "Valley of the Queens", "Egypt", 25.7275, 32.59306, "", "The valley"],
  ["S:0d604467f270/the-tomb-of-nefertari-valley-of-the-queens", "Valley of the Queens", "Egypt", 25.7275, 32.59306, "", "Nefertari"],
  ["S:139e3d0ba41c/the-tomb-of-amenherkhepeshef-qv-55-valley-of-the-queens", "Valley of the Queens", "Egypt", 25.7275, 32.59306, "", "Amenherkhepeshef"],
  ["S:1ea7c62986ad/the-temple-of-ramesses-ii-at-abu-simbel", "Abu Simbel", "Egypt", 22.33694, 31.62556, "abu-simbel-temples", "Walk through"],
  ["M:sgMWWDvdKsV", "Abu Simbel", "Egypt", 22.33694, 31.62556, "abu-simbel-temples", "3D walk"],
  ["S:2994e22162b6/the-colosseum-flavian-amphitheater-rome", "Colosseum", "Rome", 41.8903, 12.4922, "colosseum", "Walk through"],
  ["S:09b885402cb4/the-palazzo-nuovo-courtyard-capitoline-museums-rome", "Capitoline Museums", "Rome", 41.8931, 12.4828, "", "Walk through"],
  ["S:d3d7f47a1c2c/the-basilica-of-santa-croce-florence-italy", "Santa Croce", "Florence", 43.76842, 11.26272, "", "Church"],
  ["S:d61626e27014/rinuccini-chapel-basilica-of-santa-croce", "Santa Croce", "Florence", 43.76842, 11.26272, "", "Rinuccini Chapel"],
  ["S:a551a6cb8505/piazza-di-santa-croce-florence-italy", "Santa Croce", "Florence", 43.76842, 11.26272, "", "Piazza"],
  ["S:8c2f3c0c5442/the-boboli-gardens-florence-italy", "Boboli Gardens", "Florence", 43.7625, 11.24833, "", "Walk through"],
  ["S:bace39eb3d31/prato-cathedral-duomo-di-santo-stefano-italy", "Prato Cathedral", "Florence", 43.88194, 11.09778, "", "Cathedral"],
  ["S:63ff0d8d78b8/chapel-of-the-holy-belt-st-stephen-s-cathedral-prato-italy", "Prato Cathedral", "Florence", 43.88194, 11.09778, "", "Chapel of the Holy Belt"],
  ["S:406dc316e81a/scrovegni-chapel-or-arena-chapel-padova", "Scrovegni Chapel", "Padua and Bolzano", 45.41184, 11.87952, "", "Walk through"],
  ["S:0458cab3c12d/chiesa-dei-domenicani-bolzano", "Dominican Church, Bolzano", "Padua and Bolzano", 46.4975, 11.35167, "", "Walk through"],
  ["S:ef49185cc195/the-acropolis-athens-greece", "Parthenon", "Greece", 37.97167, 23.72611, "parthenon", "Acropolis"],
  ["S:f3c5e728e189/the-parthenon-and-the-acropolis-athens-greece", "Parthenon", "Greece", 37.97167, 23.72611, "parthenon", "Parthenon"],
  ["S:af929a00d4d8/the-ancient-agora-of-athens-greece", "Ancient Agora of Athens", "Greece", 37.975, 23.7225, "", "Walk through"],
  ["S:317060d9891b/the-areopagus-athens-greece", "Areopagus", "Greece", 37.97222, 23.72361, "", "Walk through"],
  ["S:4596f9af0e2d/the-sanctuary-of-apollo-at-delphi-greece", "Delphi", "Greece", 38.4823, 22.5013, "oracle-of-delphi", "Sanctuary"],
  ["S:28b3a3cd2896/the-sacred-way-and-temple-of-apollo-delphi-greece", "Delphi", "Greece", 38.4823, 22.5013, "oracle-of-delphi", "Sacred Way"],
  ["S:cbe002e40b39/the-theatre-at-delphi-greece", "Delphi", "Greece", 38.4823, 22.5013, "oracle-of-delphi", "Theatre"],
  ["S:52c299365d13/the-castalian-spring-delphi-greece", "Delphi", "Greece", 38.4823, 22.5013, "oracle-of-delphi", "Castalian Spring"],
  ["S:3491ef8ef179/the-temple-of-apollo-sounion-greece", "Temple of Poseidon, Sounion", "Greece", 37.6502, 24.02455, "temple-of-poseidon-sounion", "Walk through"],
  ["S:102a48821d49/the-temple-of-zeus-olympia-greece", "Temple of Zeus, Olympia", "Greece", 37.63778, 21.63, "temple-of-zeus-olympia", "Walk through"],
  ["S:cda3514d5a5b/mycenae-greece", "Mycenae", "Greece", 37.73028, 22.7575, "", "Walk through"],
  ["S:fda2bbf8b936/the-library-of-celsus-ephesus-turkey", "Ephesus", "Turkey", 37.94111, 27.34194, "", "Library of Celsus"],
  ["S:9efbdffb8a06/the-terrace-houses-ephesus-turkey", "Ephesus", "Turkey", 37.94111, 27.34194, "", "Terrace Houses"],
  ["S:d62132ddd88a/the-theatre-entrance-and-southeast-path-ephesus-turkey", "Ephesus", "Turkey", 37.94111, 27.34194, "", "Theatre"],
  ["S:1fc490150ecf/the-synagogue-and-bath-gymnasium-complex-sardis", "Sardis", "Turkey", 38.48833, 28.04028, "", "Synagogue and gymnasium"],
  ["S:0def100774de/the-temple-of-artemis-sardis", "Sardis", "Turkey", 38.48833, 28.04028, "", "Temple of Artemis"],
  ["S:097b8b07b9a7/jerusalem-walking-in-ancient-footsteps", "Jerusalem", "Jerusalem", 31.77667, 35.23417, "jerusalem", "Walk through"],
  ["S:ea0da1d24316/the-citadel-of-david-jerusalem", "Tower of David", "Jerusalem", 31.77611, 35.22778, "", "Walk through"],
  ["S:0d0fcf84efa1/via-dolorosa-old-city-jerusalem", "Via Dolorosa", "Jerusalem", 31.7794, 35.23207, "", "Walk through"],
  ["Z:Petra_oa_hr/Petra_oa_hr.html", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Whole site"],
  ["S:22b149144d4c/khazneh-el-far-oun-the-treasury-petra-jordan", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Treasury"],
  ["S:54db5259d0b5/the-siq-petra-jordan", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Siq"],
  ["S:afc249b7305f/the-royal-tombs-petra-jordan", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Royal Tombs"],
  ["S:972a30e68407/the-theatre-petra-jordan", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Theatre"],
  ["S:83d1df3e1381/the-great-temple-petra-jordan", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Great Temple"],
  ["S:f8e50bb3b5ec/the-monastery-ad-deir-petra-jordan", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Monastery"],
  ["S:3fc7e3b65580/the-hieroglpyhic-stairway-and-temples-20-and-22-copan-ruinas", "Copán", "Mexico and Central America", 14.8375, -89.1425, "copan", "Hieroglyphic Stairway"],
  ["S:a861c4972c08/the-acropolis-copan-ruinas-honduras", "Copán", "Mexico and Central America", 14.8375, -89.1425, "copan", "Acropolis"],
  ["S:e905b68b48e0/the-rosalila-temple-and-altar-q-copan-ruinas", "Copán", "Mexico and Central America", 14.8375, -89.1425, "copan", "Rosalila and Altar Q"],
  ["Z:Lalibela/TourWeaver_Panorama_Lalibela_Final.html", "Lalibela", "East Africa", 12.0317, 39.0411, "rock-hewn-churches-of-lalibela", "Walk through"],
  ["Z:Gondar/index.htm", "Fasil Ghebbi, Gondar", "East Africa", 12.6075, 37.47, "", "Walk through"],
  ["Z:Meroe/Meroe_North.html", "Pyramids of Meroë", "East Africa", 16.93833, 33.74917, "", "Walk through"],
  ["Z:Kilwa/TourWeaver_Kilwa.html", "Kilwa Kisiwani", "East Africa", -8.96, 39.5128, "", "Walk through"],
  ["Z:SongoMnara/TourWeaver_SongoMnara.html", "Songo Mnara", "East Africa", -9.04944, 39.56722, "", "Walk through"],
  ["Z:Kua/index.htm", "Kua ruins", "East Africa", -8.0024, 39.7807, "", "Walk through"],
  ["Z:Gede/Gede.htm", "Gede", "East Africa", -3.3094, 40.0175, "ruins-of-gedi", "Walk through"],
  ["Z:Zanzibar_pm/index.htm", "Palace Museum, Stone Town", "East Africa", -6.1611, 39.1886, "", "Walk through"],
  ["Z:Mozambique/Mozambique_Panotour.htm", "Island of Mozambique", "East Africa", -15.03667, 40.73278, "island-of-mozambique", "Walk through"],
  ["Z:Elmina/TourWeaver_Elmina_Panotour.html", "Elmina Castle", "West Africa", 5.0826, -1.3481, "elmina-castle", "Walk through"],
  ["Z:Jago/Jago_Panotour.html", "Fort Coenraadsburg, Elmina", "West Africa", 5.0846, -1.3497, "", "Walk through"],
  ["Z:Cape_Coast/Cape_Coast_Panotour.htm", "Cape Coast Castle", "West Africa", 5.10361, -1.24111, "cape-coast-castle", "Walk through"],
  ["Z:Axim/Axim_Panotour.htm", "Fort St. Anthony, Axim", "West Africa", 4.8686, -2.2408, "", "Walk through"],
  ["Z:Shama/Shama_Panotour.html", "Fort San Sebastian, Shama", "West Africa", 5.0099, -1.6334, "", "Walk through"],
  ["Z:Besease/TourWeaver_Panorama_Besease.html", "Besease shrine", "West Africa", 6.7036, -1.4983, "", "Walk through"],
  ["Z:Bunce_Island_Fort/index.htm", "Bunce Island", "West Africa", 8.56991, -13.04022, "bunce-island", "Walk through"],
  ["Z:Djemila/Tourweaver_DjemilaTour.html", "Djémila", "North Africa", 36.31667, 5.73333, "", "Walk through"],
  ["Z:castle_of_good_hope/index.htm", "Castle of Good Hope", "Southern Africa", -33.9259, 18.4278, "", "Walk through"],
  ["Z:Bagan/1192_Naga_yon-hpaya/index.htm", "Bagan", "Myanmar", 21.1725, 94.86, "temples-of-bagan", "Naga-yon"],
  ["Z:Bagan/154_Kyauk_ku_umin/index.htm", "Bagan", "Myanmar", 21.1725, 94.86, "temples-of-bagan", "Kyauk-ku-umin"],
  ["T:Golconda_Tour/Golconda_Tour.html", "Golconda Fort", "South India", 17.38306, 78.40111, "", "Walk through"],
  ["T:nagarjuna-konda/Nagarjunakonda.html", "Nagarjunakonda", "South India", 16.52189, 79.24285, "", "Walk through"],
  ["T:Kailasanathar_Temple/Kailasanathar_Temple.html", "Kailasanathar Temple, Kanchipuram", "South India", 12.84231, 79.68967, "", "Walk through"],
  ["T:Kamakshiamman_Temple/Kamakshiamman_Temple.html", "Kamakshi Amman Temple, Kanchipuram", "South India", 12.84068, 79.70324, "", "Walk through"],
  ["T:Chandragiri_Fort_Tour/Chandragiri_Fort_Tour.html", "Chandragiri Fort", "South India", 13.5866, 79.3168, "", "Walk through"],
  ["T:alampur-jogulamba-temple/Alampur_Jogulamba_Tour.html", "Alampur temples", "South India", 15.8784, 78.1338, "", "Walk through"],
  ["F:dfaf413f0ce845a3b798b0bb4079962a", "Hampi", "South India", 15.33444, 76.46222, "hampi", "Chariot 3D"],
  ["F:9f2a30594cfc4141b8bd8ec94f6c85f5", "Hampi", "South India", 15.33444, 76.46222, "hampi", "Mahanavami Dibba 3D"],
  ["F:5ca97c7c70e1408bbd241c9466a040d8", "Hampi", "South India", 15.33444, 76.46222, "hampi", "From above 3D"],
  ["F:f1822a22fa584fdabcf1105ad863f29f", "Bidar", "South India", 17.92444, 77.52667, "", "Humayun Shah's tomb 3D"],
  ["F:295c9496db134eb2a7e4d60f0ce8a73c", "Aihole", "South India", 16.01991, 75.88124, "", "3D"],
  ["K:7lhk1", "Lepakshi", "South India", 13.81, 77.6, "", "360 photo", "uday029"],
  ["F:510ad47a389c4c8780a1468719e4b339", "Mahabalipuram", "South India", 12.61639, 80.19861, "shore-temple", "Arjuna's Penance 3D"],
  ["F:78ba4f358235443cb5ca216fee7ad561", "Mahabalipuram", "South India", 12.61639, 80.19861, "shore-temple", "Tiger Cave 3D"],
  ["Y:amarbayasgalant", "Amarbayasgalant Monastery", "Mongolia", 49.48, 105.085, "", "3D tour", "Amarbayasgalant Monastery"],
  ["Y:choijin-lama", "Choijin Lama Temple", "Mongolia", 47.91477, 106.91907, "", "3D tour", "Choijin Lama Temple"],
  ["Y:areni-cave", "Areni-1 cave", "Armenia", 39.73132, 45.20312, "", "3D tour", "Areni-1 Cave"],
  ["Y:bagerhat", "Sixty Dome Mosque", "Bangladesh and Nepal", 22.67445, 89.74182, "sixty-dome-mosque", "3D tour", "the Sixty Dome Mosque"],
  ["Y:patan", "Patan Durbar Square", "Bangladesh and Nepal", 27.6727, 85.32512, "", "3D tour", "Patan Durbar Square"],
  ["Y:elephanta", "Elephanta Caves", "India", 18.96304, 72.93174, "", "3D tour", "the Elephanta Caves"],
  ["Y:gateway-of-india", "Gateway of India", "India", 18.922, 72.8347, "", "3D tour", "the Gateway of India"],
  ["Y:jaigarh-fort", "Jaigarh Fort", "India", 26.98307, 75.8443, "", "3D tour", "Jaigarh Fort"],
  ["Y:preah-vihear", "Preah Vihear", "Southeast Asia", 14.3903, 104.68021, "", "3D tour", "Preah Vihear"],
  ["Y:watarun", "Wat Arun", "Southeast Asia", 13.74361, 100.48889, "", "3D tour", "Wat Arun"],
  ["Y:san-sebastian-basilica", "San Sebastian Basilica, Manila", "Southeast Asia", 14.59968, 120.98906, "", "3D tour", "San Sebastian Basilica"],
  ["Y:jabal-banat", "Hegra", "Arabia", 26.78861, 37.95999, "hegra-madain-salih", "3D tour", "Jabal AlBanat at Hegra"],
  ["Y:fujairah", "Fujairah Fort", "Arabia", 25.13861, 56.33712, "", "3D tour", "Fujairah Fort"],
  ["Y:madaba", "Madaba Map", "Jordan", 31.716, 35.7939, "madaba-map", "3D tour", "St George's Church and the Madaba Map"],
  ["Y:petra", "Petra", "Jordan", 30.3285, 35.4444, "petra", "Ad Deir 3D", "Ad Deir at Petra"],
  ["Y:el-jem", "Amphitheatre of El Jem", "North Africa", 35.29643, 10.70671, "amphitheatre-of-el-jem", "3D tour", "El Jem"],
  ["Y:kurru", "El-Kurru", "East Africa", 18.40925, 31.77046, "", "3D tour", "El Kurru"],
  ["Y:kilwa-kisiwani", "Kilwa Kisiwani", "East Africa", -8.95921, 39.49819, "", "Great Mosque 3D", "the Great Mosque of Kilwa Kisiwani"],
  ["Y:djenne", "Great Mosque of Djenné", "West Africa", 13.90516, -4.55548, "great-mosque-of-djenne", "3D tour", "the Great Mosque of Djenné"],
  ["Y:busanyin-shrine", "Osun-Osogbo grove", "West Africa", 7.75873, 4.55626, "", "3D tour", "the Busanyin Shrine at Osun-Osogbo"],
  ["Y:great-zimbabwe", "Great Zimbabwe", "Southern Africa", -20.27279, 30.93425, "great-enclosure", "3D tour", "Great Zimbabwe"],
  ["Y:pompeii-forum", "Pompeii", "Campania", 40.746, 14.4989, "vesuvius-buries-pompeii", "3D tour", "the Forum of Pompeii"],
  ["Y:civita", "Civita di Bagnoregio", "Around Rome", 42.62776, 12.11374, "", "3D tour", "Civita di Bagnoregio"],
  ["Y:temple-of-apollo", "Portara, Naxos", "Greece", 37.1105, 25.3727, "", "3D tour", "the Temple of Apollo at Naxos"],
  ["Y:qassiarsuk", "Brattahlíð", "Greenland", 61.1496, -45.5148, "", "3D tour", "Qassiarsuk"],
  ["Y:rapanui", "Rapa Nui", "Rapa Nui", -27.07447, -109.32241, "moai-of-rapa-nui", "Anakena", "the moai at Anakena"],
  ["Y:orongo", "Rapa Nui", "Rapa Nui", -27.18978, -109.44316, "moai-of-rapa-nui", "Orongo", "Orongo"],
  ["Y:chan-chan", "Chan Chan", "Peru", -8.10583, -79.07444, "chan-chan", "3D tour", "Chan Chan"],
  ["Y:ouro-preto", "Ouro Preto gold mine", "Brazil", -20.37638, -43.5161, "", "3D tour", "the Ouro Preto gold mine"],
  ["Y:lamanai", "Lamanai", "Mexico and Central America", 17.765, -88.65301, "lamanai", "3D tour", "Lamanai"],
  ["Y:bartolome", "San Bartolomé, Chihuahua", "Mexico and Central America", 26.93935, -105.39376, "", "3D tour", "San Bartolomé Church"],
  ["Y:cliff-palace", "Cliff Palace, Mesa Verde", "American Southwest", 37.16686, -108.47336, "cliff-palace-mesa-verde", "3D tour", "Cliff Palace"],
  ["Y:balcony-house", "Balcony House, Mesa Verde", "American Southwest", 37.16153, -108.4647, "", "Balcony House", "Balcony House"],
  ["Y:resonant-balcony-house", "Balcony House, Mesa Verde", "American Southwest", 37.24275, -108.63027, "", "A Hopi lens", "Balcony House through a Hopi lens"],
  ["Y:resonant-wupatki-pueblo", "Wupatki Pueblo", "American Southwest", 35.52119, -111.37546, "", "3D tour", "Wupatki Pueblo"],
  ["Y:butler-wash", "Bears Ears ruins", "American Southwest", 37.52445, -109.89578, "", "Butler Wash", "Butler Wash"],
  ["Y:house-on-fire", "Bears Ears ruins", "American Southwest", 37.54421, -109.74411, "", "House on Fire", "House on Fire"],
  ["Y:mule-canyon-village", "Bears Ears ruins", "American Southwest", 37.53941, -109.7416, "", "Mule Canyon", "Mule Canyon Village"],
  ["Y:river-house", "Bears Ears ruins", "American Southwest", 37.29789, -109.54533, "", "River House", "River House"],
  ["Y:monarch", "Bears Ears ruins", "American Southwest", 37.35737, -109.6637, "", "Monarch Cave", "Monarch Cave"],
  ["Y:dinetah", "Dinétah petroglyphs", "American Southwest", 36.54756, -107.62939, "", "3D tour", "Dinétah"],
  ["Y:chumash", "Chumash Painted Cave", "United States", 34.50418, -119.78761, "", "3D tour", "Chumash Painted Cave"],
  ["Y:sue-meg", "Sumêg Yurok village", "United States", 41.13716, -124.15665, "", "3D tour", "Sumêg Village"],
  ["Y:totem-bight", "Totem Bight", "United States", 55.42012, -131.77511, "", "3D tour", "Totem Bight"],
  ["Y:weaverville-joss-house", "Weaverville Joss House", "United States", 40.73182, -122.9431, "", "3D tour", "the Weaverville Joss House"],
  ["Y:george-wythe-house", "George Wythe House, Williamsburg", "United States", 37.1617, -76.42, "", "3D tour", "the George Wythe House"],
  ["Y:lincoln-memorial", "Lincoln Memorial", "United States", 38.88926, -77.05019, "", "3D tour", "the Lincoln Memorial"],
  ["Y:mount-rushmore", "Mount Rushmore", "United States", 43.8792, -103.4583, "", "3D tour", "Mount Rushmore"],
  ["Y:stonewall", "Stonewall Inn", "United States", 40.73357, -74.00235, "stonewall-riots", "3D tour", "the Stonewall Inn"],
  ["Y:uss-utah", "USS Utah, Pearl Harbor", "United States", 21.365, -157.95, "attack-on-pearl-harbor", "3D tour", "the USS Utah Memorial"],
];
const KIND = {
  S: { u: "https://app.spacery.dev/s/", by: "Photos: Mused." },
  Z: { u: "https://www.zamaniproject.org/tl_files/data/panotours/", by: "Photos: the Zamani Project, University of Cape Town." },
  M: { u: "https://my.matterport.com/show/?play=1&m=", by: "3D walk made for Egypt's Ministry of Tourism and Antiquities, 2020 and 2021." },
  T: { u: "https://tours.touritvirtually.com/", by: "Photos: TouritVirtually." },
  K: { u: "https://kuula.co/share/", end: "?fs=1&vr=0&thumbs=1&info=1", by: ", on Kuula.", pic: 1 },
  Y: { u: "https://tapestry.cyark.org/content/", cy: 1 },
  F: { scan: 1 },
};
for (const [ref, name, g, lat, lon, page, t, who] of MORE){
  const kind = KIND[ref[0]], ref1 = ref.slice(2), own = page && KBX[page], key = own ? page : "t:" + name;
  const S = SITES[key] || (SITES[key] = {});
  if (!S.name) S.name = name;
  if (!S.g) S.g = g;
  if (!S.ll) S.ll = [lat, lon];
  if (kind.scan) (S.scans || (S.scans = [])).push({ u: ref1, t });
  else (kind.pic ? (S.pics || (S.pics = [])) : (S.tours || (S.tours = []))).push({ url: kind.u + ref1 + (kind.end || ""), t, by: kind.cy ? "Explore " + who + " on Tapestry by CyArk." : who ? "Photo: " + who + kind.by : kind.by });
}
for (const [path, name, g, lat, lon] of TOURS){
  const id = TK[path], own = id && KBX[id], key = own ? id : "t:" + path;
  const S = SITES[key] || (SITES[key] = { name, g, ll: [lat, lon] });
  if (!S.g) S.g = g;
  if (!S.ll) S.ll = [lat, lon];
  if (own && !S.name && / (built|rebuilt|begun|founded)$/i.test(KBX[id].name)) S.name = name;
  (S.tours || (S.tours = [])).unshift({ url: MCID + path + "/", t: "Walk through", by: CU + (S.year ? ", " + S.year + "." : ".") });
}
for (const S of Object.values(SITES)) if (S.tours) S.tours.sort((a, b) => (a.by === AIR) - (b.by === AIR));   /* walks before views from the air */
const tourOnly = id => id.startsWith("t:");
const live = id => SITES[id] && (tourOnly(id) || KBX[id]);
const nameOf = id => SITES[id].name || KBX[id].name;
const llOf = id => { const S = SITES[id], k = !tourOnly(id) && KBX[id]; return (k && k.ll) || S.ll || S.out || null; };

const css = document.createElement("style");
css.textContent = `
.siteview{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;background:var(--surface);border-right:1px solid var(--line-strong)}
.siteview[hidden]{display:none}
.svbar{flex:none;display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--line-strong)}
.svbar h2{flex:1 1 auto;min-width:5em;margin:0 8px 0 2px;font-family:var(--display);font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.svtabs{flex:0 1 auto;min-width:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin}
.svtabs .btn{flex:none}
.svtabs[hidden]{display:none}
.sitepop{position:absolute;z-index:6;min-width:190px;max-width:260px;max-height:260px;overflow:auto;padding:4px 10px;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--r);box-shadow:2px 2px 0 var(--shade)}
.sitepop .sitem{padding:6px 2px;font-size:13.5px}
.sitepop .sitem:last-child{border-bottom:0}
.svbar .btn{height:30px;font-size:13.5px}
.svnote{flex:none;margin:0;padding:6px 12px;font-size:12.5px;color:var(--muted);border-bottom:1px solid var(--line)}
.svnote:empty{display:none}
.svframe{flex:1;min-height:0;position:relative;background:#000}
.svframe iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
@media (max-width:760px){ .siteview{position:fixed;z-index:90} .svbar{flex-wrap:wrap} .svtabs{order:3;flex-basis:100%} }`;
document.head.append(css);

const box = el("section", "siteview"); box.hidden = true; box.setAttribute("aria-label", "The site today");
const bar = el("div", "svbar"), h = el("h2"), tabs = el("div", "svtabs"), x = el("button", "x", "×");
x.type = "button"; x.setAttribute("aria-label", "Close the site view"); x.title = "Close (Escape)";
const note = el("p", "svnote"), frame = el("div", "svframe");
bar.append(h, tabs, x); box.append(bar, note, frame);
document.querySelector(".center").append(box);

let cur = null;                                         /* the site on view */
const views = S => [...(S.tours || []), ...(S.out ? [{ t: "Outside", p: S.out }] : []), ...(S.in ? [{ t: "Inside", p: S.in }] : []), ...(S.sv || []), ...(S.pics || []), ...(S.scans || [])];
function show(id, i){
  const S = SITES[id], V = views(S);
  for (const [j, b] of [...tabs.children].entries()) b.setAttribute("aria-pressed", j === i);
  frame.textContent = "";
  const f = document.createElement("iframe"), v = V[i];
  f.allowFullscreen = true; f.title = h.textContent + ": " + v.t;
  note.textContent = [S.note, v.by].filter(Boolean).join(" ");
  if (v.p){ const [lat, lon, hd] = v.p; f.src = `https://maps.google.com/maps?layer=c&cbll=${lat},${lon}&cbp=11,${hd},0,0,0&output=svembed`; }
  else if (v.url){ f.src = v.url; f.allow = "fullscreen; autoplay; xr-spatial-tracking; gyroscope; accelerometer"; }
  else { f.src = `https://sketchfab.com/models/${v.u}/embed?autostart=1&ui_theme=dark&dnt=1`; f.allow = "autoplay; fullscreen; xr-spatial-tracking"; }
  frame.append(f);
}
function open(id){
  if (!live(id)) return;
  cur = id; h.textContent = nameOf(id); tabs.textContent = "";
  const V = views(SITES[id]);
  V.forEach((v, i) => { const b = el("button", "btn", v.t); b.type = "button"; b.addEventListener("click", () => show(id, i)); tabs.append(b); });
  tabs.hidden = V.length < 2;
  box.hidden = false; show(id, 0); x.focus({ preventScroll: true });
}
function close(){ if (box.hidden) return; box.hidden = true; frame.textContent = ""; cur = null; }
x.addEventListener("click", close);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden){ e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);

/* a card for another item closes the view; the card of the site on view keeps it */
const sel0 = select;
select = function(obj){ const k = obj && (obj.kb || KBOF.get(obj)); if (cur && k !== cur) close(); return sel0.apply(this, arguments); };

/* go to a site: its card when it has a page, else the map moves there; then the view opens */
function goTo(id){
  if (!tourOnly(id)){ kbGo(id); setTimeout(() => open(id), 0); return; }
  const g = llOf(id);
  if (g && typeof flyTo === "function" && MAP.on && MAP.view && mapW) flyTo({ x: g[1], y: g[0], k: clampK(Math.max(MAP.view.k, Math.min(mapW, mapH) / 4)) });
  open(id);
}

/* the card: View the site, among its actions (called from select) */
window.siteButton = (acts, id) => {
  if (!live(id)) return;
  const b = el("button", "btn actb siteb"); b.type = "button"; b.title = "See the place as it is today: photo tours, Street View and 3D scans";
  b.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><ellipse cx="8" cy="8" rx="6.5" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><path d="M8 2v2M8 12v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span>View the site</span>';
  b.addEventListener("click", () => open(id));
  acts.insertBefore(b, acts.querySelector("a"));
};

/* the Library: Sites, by place */
window.sitesLibrary = sec => {
  const ids = Object.keys(SITES).filter(live);
  if (!ids.length) return;
  const D = sec("sites", "Sites today", ids.length, "Sites");
  D.append(el("p", "spint", "The place as it stands now: photo tours you can walk through, single 360 photos, Street View outside and in, and 3D scans made from visitors' photos. The pins on the map are the same places."));
  const G = new Map();
  for (const id of ids){ const g = SITES[id].g || "Elsewhere"; if (!G.has(g)) G.set(g, []); G.get(g).push(id); }
  for (const g of [...G.keys()].sort((a, b) => a.localeCompare(b))){
    D.append(el("div", "sbook", g));
    for (const id of G.get(g).sort((a, b) => nameOf(a).localeCompare(nameOf(b)))){
      const b = el("button", "sitem"); b.type = "button";
      b.append(el("b", null, nameOf(id)), el("span", null, views(SITES[id]).map(v => v.t).join(", ")));
      b.addEventListener("click", () => { setStories(false); goTo(id); });
      D.append(b);
    }
  }
};

/* the map: a small pin at each site, whatever the year, once the map is zoomed in to about a country (from far they would crowd it).
   Pins that would touch share one, with a count; a click on it zooms in. The Sites button above the map hides them. */
if (typeof paint !== "function" || typeof mapCanvas === "undefined") return;
let pinsOn = true; try { pinsOn = localStorage.getItem("wh8-sites") !== "0"; } catch (e) {}
const tb = el("button", "mb mapt", "Sites"); tb.type = "button"; tb.id = "mapSites";
tb.title = "Pins for the places you can walk through today, shown when the map is zoomed in";
tb.setAttribute("aria-pressed", pinsOn);
tb.addEventListener("click", () => { pinsOn = !pinsOn; tb.setAttribute("aria-pressed", pinsOn); try { localStorage.setItem("wh8-sites", pinsOn ? "1" : "0"); } catch (e) {} drawMap(); });
const tools = document.querySelector("#mapHead .mtools"); if (tools) tools.prepend(tb);

let PINS = [];
const paint0 = paint;
paint = function(){
  paint0.apply(this, arguments);
  PINS = [];
  if (!pinsOn || !MAP.on || !mapW || !MAP.view || mapZoom() < 3) return;
  const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue("--ink").trim(), surf = cs.getPropertyValue("--surface").trim();
  const cells = [], C = 18;   /* a pin joins the first one within C px, so no two pins cover each other */
  for (const id of Object.keys(SITES)){
    if (!live(id)) continue;
    const g = llOf(id); if (!g) continue;
    const [px, py] = tiltPt(sx(g[1]), sy(g[0]));
    if (px < -10 || px > mapW + 10 || py < -10 || py > mapH + 10) continue;
    const c = cells.find(c => Math.hypot(c.x - px, c.y - py) < C);
    if (c) c.ids.push(id); else cells.push({ x: px, y: py, ids: [id] });
  }
  mctx.save(); mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const c of cells){
    const n = c.ids.length, r = n > 1 ? 8 : 5;
    mctx.beginPath(); mctx.arc(c.x, c.y, r, 0, 7); mctx.fillStyle = surf; mctx.fill(); mctx.lineWidth = 1.4; mctx.strokeStyle = ink; mctx.stroke();
    if (n > 1){ mctx.fillStyle = ink; mctx.font = '600 10px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; mctx.textAlign = "center"; mctx.textBaseline = "middle"; mctx.fillText(n > 99 ? "99" : String(n), c.x, c.y + .5); }
    else { mctx.beginPath(); mctx.arc(c.x, c.y, 1.7, 0, 7); mctx.fillStyle = ink; mctx.fill(); }
    PINS.push({ ...c, r });
  }
  mctx.restore(); mctx.textAlign = "left"; mctx.textBaseline = "alphabetic";
};
const pinAt = (x, y) => PINS.find(p => Math.hypot(p.x - x, p.y - y) <= p.r + 3);
let down = null;
mapCanvas.addEventListener("pointerdown", e => {
  if (e.button || MAP.boxMode || e.shiftKey) return;
  const [x, y] = local(e), p = pinAt(x, y); if (!p) return;
  down = { p, x, y }; e.stopImmediatePropagation(); e.preventDefault();
}, true);
mapCanvas.addEventListener("pointerup", e => {
  if (!down) return;
  const d = down; down = null; e.stopImmediatePropagation();
  const [x, y] = local(e); if (Math.hypot(x - d.x, y - d.y) > 6) return;
  tip.style.display = "none";
  if (d.p.ids.length === 1) return goTo(d.p.ids[0]);
  /* a crowd: zoom in while the map can, then list them */
  if (MAP.view.k * 1.5 <= KMAX){
    let a = [180, 90, -180, -90]; for (const id of d.p.ids){ const g = llOf(id); a = [Math.min(a[0], g[1]), Math.min(a[1], g[0]), Math.max(a[2], g[1]), Math.max(a[3], g[0])]; }
    const v = boxView([a[0] - .02, a[1] - .02, a[2] + .02, a[3] + .02]); v.k = Math.max(v.k, clampK(MAP.view.k * 2.5)); return flyTo(v);
  }
  popList(d.p);
}, true);
/* the list for a crowd the map can't split */
const pop = el("div", "sitepop"); pop.hidden = true; pop.setAttribute("role", "menu"); mapCanvas.parentNode.append(pop);
function popList(p){
  pop.textContent = "";
  for (const id of p.ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))){
    const b = el("button", "sitem", nameOf(id)); b.type = "button"; b.setAttribute("role", "menuitem");
    b.addEventListener("click", () => { pop.hidden = true; goTo(id); }); pop.append(b);
  }
  pop.hidden = false;
  pop.style.left = Math.max(4, Math.min(p.x + 10, mapW - pop.offsetWidth - 4)) + "px";
  pop.style.top = Math.max(4, Math.min(p.y - 10, mapH - pop.offsetHeight - 4)) + "px";
  pop.firstChild.focus({ preventScroll: true });
}
const unpop = () => { pop.hidden = true; };
document.addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target)) unpop(); }, true);
mapCanvas.addEventListener("wheel", unpop, { passive: true });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden){ e.stopImmediatePropagation(); unpop(); } }, true);
mapCanvas.addEventListener("pointermove", e => {
  if (drag || down) return;
  const [x, y] = local(e), p = pinAt(x, y); if (!p) return;
  e.stopImmediatePropagation();
  tip.textContent = p.ids.length === 1 ? nameOf(p.ids[0]) : p.ids.length + " sites";
  tip.style.display = "block"; tip.style.left = Math.min(x + 12, mapW - tip.offsetWidth - 4) + "px"; tip.style.top = Math.max(4, y - 28) + "px";
  mapCanvas.style.cursor = "pointer";
}, true);
})();
