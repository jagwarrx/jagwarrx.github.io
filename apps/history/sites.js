/* Sites today: a place as it stands now, opened from its card ("View the site"), from the Library (Sites) or from its pin on the map.
   The viewer covers the chart and leaves the card beside it. Its tabs:
     tours             a photo tour someone else hosts (a university, a ministry), walked point to point. Only ones that load in a frame.
     Outside, Inside   Google Street View, no key: the panorama nearest the point. A point inside a building finds the
                       indoor photos where someone took them. Photos by Google can be walked (arrows); visitors' photos are single 360s.
     scans             Sketchfab models made from photos (photogrammetry). Drag to turn, scroll to zoom, double-click a spot to go there.
   SITES: page id -> {name (when the page's own is an event, e.g. Taj Mahal begun), g: its group in the Library, out: [lat, lon, heading],
     in: [lat, lon, heading], scans: [{u: Sketchfab id, t: tab name}], tours: [{url, t, by: the credit}], note}.
   TOURS: Columbia's Media Center for Art History panorama tours, [folder, name, group, lat, lon]; TK ties a tour to its page.
     A tour with a page joins that page's site; one without a page is a site of its own ("t:" + folder), on the map and in the Library.
   Each point, scan and tour was checked by eye (26 and 27 Nov 2026). */
(() => {
const MCID = "https://mcid.mcah.columbia.edu/media/panos/pano-tours/", CU = "Photos: Media Center for Art History, Columbia University";
const AIR = "Photos: AirPano, from the air and on the ground.";
const GIZA = "Photos: the Giza Project at Harvard with Mused, about 2020 to 2022.";
const SITES = {
  "hagia-sophia":          { g: "Istanbul", out: [41.00740, 28.97895, 60], in: [41.00788, 28.97960, 60], scans: [{ u: "7e7d826a49d248a7a81d4129ce976420", t: "3D inside" }], year: 2021 },
  "colosseum":             { g: "Rome", out: [41.89127, 12.49145, 90], scans: [{ u: "544c64b6445e4899a17350c949b7766a", t: "3D" }],
                             tours: [{ url: "https://www.airpano.com/embed.php?3D=italy-rome-colosseum", t: "Tour", by: AIR }] },
  "taj-mahal-begun":       { name: "Taj Mahal", g: "India", out: [27.17330, 78.04210, 0],
                             tours: [{ url: "https://www.airpano.com/embed.php?3D=taj-mahal-india-2", t: "Tour", by: AIR }] },
  "angkor-wat-built":      { name: "Angkor Wat", out: [13.41090, 103.86400, 90], scans: [{ u: "86a97678ae6d4f41a14c13d77990f223", t: "3D" }], year: 2013 },
  "great-pyramid-of-giza": { g: "Egypt", out: [29.97730, 31.13250, 40], scans: [{ u: "4a251113722f4d969b6cf2ca5f35c502", t: "3D" }, { u: "aa5a8d05e15d4bc4becb6fcd88c5a35d", t: "Tomb of Idu" }],
                             tours: [{ url: "https://app.spacery.dev/s/0b7dabf2e410/great-pyramid-of-giza", t: "Walk inside", by: GIZA },
                                     { url: "https://app.spacery.dev/s/48a9f8d4fddb/the-tomb-of-queen-meresankh-iii-giza", t: "Tomb of Meresankh", by: GIZA },
                                     { url: "https://app.spacery.dev/s/5b073eb82f3f/the-great-sphinx-of-giza", t: "Sphinx", by: GIZA }] },
  "machu-picchu":          { g: "Peru", out: [-13.16310, -72.54500, 0], scans: [{ u: "eb2e2c36ba8a4d8197dc30dd947984d2", t: "3D" }],
                             tours: [{ url: "https://www.airpano.com/embed.php?3D=machu-picchu-peru", t: "Tour", by: AIR }] },
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
  ["Qutb/Fatima-Sultana", "Tomb of Fatima Sultana", "India", 17.395, 78.396],
  ["Qutb/Hyath-Bakshi-Begum", "Tomb of Hayat Bakshi Begum", "India", 17.395, 78.396],
  ["Qutb/Mohammed-Quli-Qutb-Shah", "Tomb of Muhammad Quli Qutb Shah", "India", 17.395, 78.396],
  ["Qutb/Mohammed-Qutb-Shah", "Tomb of Muhammad Qutb Shah", "India", 17.395, 78.396],
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
for (const [path, name, g, lat, lon] of TOURS){
  const id = TK[path], own = id && KBX[id], key = own ? id : "t:" + path;
  const S = SITES[key] || (SITES[key] = { name, g, ll: [lat, lon] });
  if (!S.g) S.g = g;
  if (!S.ll) S.ll = [lat, lon];
  if (own && !S.name && / (built|rebuilt|begun|founded)$/i.test(KBX[id].name)) S.name = name;
  (S.tours || (S.tours = [])).unshift({ url: MCID + path + "/", t: "Walk through", by: CU + (S.year ? ", " + S.year + "." : ".") });
}
const tourOnly = id => id.startsWith("t:");
const live = id => SITES[id] && (tourOnly(id) || KBX[id]);
const nameOf = id => SITES[id].name || KBX[id].name;
const llOf = id => { const S = SITES[id], k = !tourOnly(id) && KBX[id]; return (k && k.ll) || S.ll || S.out || null; };

const css = document.createElement("style");
css.textContent = `
.siteview{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;background:var(--surface);border-right:1px solid var(--line-strong)}
.siteview[hidden]{display:none}
.svbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--line-strong)}
.svbar h2{flex:1 1 auto;min-width:0;margin:0 8px 0 2px;font-family:var(--display);font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.svtabs{display:flex;flex-wrap:wrap;gap:6px}
.svtabs[hidden]{display:none}
.sitepop{position:absolute;z-index:6;min-width:190px;max-width:260px;max-height:260px;overflow:auto;padding:4px 10px;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--r);box-shadow:2px 2px 0 var(--shade)}
.sitepop .sitem{padding:6px 2px;font-size:13.5px}
.sitepop .sitem:last-child{border-bottom:0}
.svbar .btn{height:30px;font-size:13.5px}
.svnote{flex:none;margin:0;padding:6px 12px;font-size:12.5px;color:var(--muted);border-bottom:1px solid var(--line)}
.svnote:empty{display:none}
.svframe{flex:1;min-height:0;position:relative;background:#000}
.svframe iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
@media (max-width:760px){ .siteview{position:fixed;z-index:90} }`;
document.head.append(css);

const box = el("section", "siteview"); box.hidden = true; box.setAttribute("aria-label", "The site today");
const bar = el("div", "svbar"), h = el("h2"), tabs = el("div", "svtabs"), x = el("button", "x", "×");
x.type = "button"; x.setAttribute("aria-label", "Close the site view"); x.title = "Close (Escape)";
const note = el("p", "svnote"), frame = el("div", "svframe");
bar.append(h, tabs, x); box.append(bar, note, frame);
document.querySelector(".center").append(box);

let cur = null;                                         /* the site on view */
const views = S => [...(S.tours || []), ...(S.out ? [{ t: "Outside", p: S.out }] : []), ...(S.in ? [{ t: "Inside", p: S.in }] : []), ...(S.scans || [])];
function show(id, i){
  const S = SITES[id], V = views(S);
  for (const [j, b] of [...tabs.children].entries()) b.setAttribute("aria-pressed", j === i);
  frame.textContent = "";
  const f = document.createElement("iframe"), v = V[i];
  f.allowFullscreen = true; f.title = h.textContent + ": " + v.t;
  note.textContent = [S.note, v.by].filter(Boolean).join(" ");
  if (v.p){ const [lat, lon, hd] = v.p; f.src = `https://maps.google.com/maps?layer=c&cbll=${lat},${lon}&cbp=11,${hd},0,0,0&output=svembed`; }
  else if (v.url){ f.src = v.url; f.allow = "fullscreen; xr-spatial-tracking; gyroscope; accelerometer"; }
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
  D.append(el("p", "spint", "The place as it stands now: photo tours you can walk through, Street View outside and in, and 3D scans made from visitors' photos. The pins on the map are the same places."));
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
