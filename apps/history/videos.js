/* Videos for stories and cards.
   VIDEOS: id: {title, yt: YouTube id, or src: a video file}. A story step points at one with v: {id, from, to} in seconds.
   A video with item: "<page id or item name>" also shows on that item's card, and the item's marker gets a second ring. */
const VIDEOS = {
  "marathon":   {title:"Marathon: why the smaller army attacked", src:"videos/battle-of-marathon.mp4", poster:"videos/battle-of-marathon.jpg", item:"battle-of-marathon"},
  "salamis":    {title:"Salamis: the place, and the false message", src:"videos/battle-of-salamis.mp4", poster:"videos/battle-of-salamis.jpg", item:"battle-of-salamis"},
  "leuctra":    {title:"Leuctra: the best men on the wrong side", src:"videos/battle-of-leuctra.mp4", poster:"videos/battle-of-leuctra.jpg", item:"battle-of-leuctra"},
  "gaugamela":  {title:"Gaugamela: the prepared ground, and the man who walked off it", src:"videos/battle-of-gaugamela.mp4", poster:"videos/battle-of-gaugamela.jpg", item:"battle-of-gaugamela"},
  "cannae":     {title:"Cannae: Rome's weight against Hannibal's trap", src:"videos/battle-of-cannae.mp4", poster:"videos/battle-of-cannae.jpg", item:"battle-of-cannae"},
  "pharsalus":  {title:"Pharsalus: the line Caesar hid", src:"videos/battle-of-pharsalus.mp4", poster:"videos/battle-of-pharsalus.jpg", item:"battle-of-pharsalus"},
  "bach-dang":  {title:"Bạch Đằng: won by the tide", src:"videos/battle-of-bach-dang.mp4", poster:"videos/battle-of-bach-dang.jpg", item:"battle-of-bach-dang"},
  "ain-jalut":  {title:"Ain Jalut: the Mongols meet their own trick", src:"videos/battle-of-ain-jalut.mp4", poster:"videos/battle-of-ain-jalut.jpg", item:"battle-of-ain-jalut"},
  "panipat":    {title:"First Panipat: a front built to be narrow", src:"videos/first-battle-of-panipat.mp4", poster:"videos/first-battle-of-panipat.jpg", item:"first-battle-of-panipat"},
  "isandlwana": {title:"Isandlwana: how a modern army lost an afternoon", src:"videos/battle-of-isandlwana.mp4", poster:"videos/battle-of-isandlwana.jpg", item:"battle-of-isandlwana"}
};
