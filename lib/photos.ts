// Car photos from Wikimedia Commons. Their licences require crediting the author and licence.

export type Photo = { src: string; author: string; license: string; sourceUrl: string };

export const PHOTOS: Record<string, Photo> = {
  "1": { src: "/cars/1.jpg", author: "Vauxford", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:2017_Toyota_Yaris_1.5_facelift_Front.jpg" },
  "2": { src: "/cars/2.jpg", author: "Vauxford", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:2017_Volkswagen_Golf_SE_TSi_1.4_Front.jpg" },
  "3": { src: "/cars/3.jpg", author: "Vauxford", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Skoda_Octavia_SE_TDi_S-A_1.6_Front.jpg" },
  "4": { src: "/cars/4.jpg", author: "Alexander Migl", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:Ford_Fiesta_MK7_Facelift_1X7A0408.jpg" },
  "5": { src: "/cars/5.jpg", author: "LuvsMG481", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:2021_Hyundai_Tucson_Elite_N-Line_front.jpg" },
  "6": { src: "/cars/6.jpg", author: "Dinkun Chen", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:NISSAN_QASHQAI_(J11)_China.jpg" },
  "7": { src: "/cars/7.jpg", author: "Dinkun Chen", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:BMW_3_SERIES_SEDAN_(F30)_China.jpg" },
  "8": { src: "/cars/8.jpg", author: "Dorieo", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:Mazda_MX-5_(NC)_en_Valencia.jpg" },
  "9": { src: "/cars/9.jpg", author: "Alexander-93", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:2023_Toyota_Corolla_Hybrid_(E210)_hatchback_IMG_9884.jpg" },
  "10": { src: "/cars/10.jpg", author: "M 93", license: "CC BY-SA 3.0 de", sourceUrl: "https://commons.wikimedia.org/wiki/File:Audi_A6_S-line_(C7)_%E2%80%93_Frontansicht,_1._Mai_2012,_D%C3%BCsseldorf.jpg" },
  "11": { src: "/cars/11.jpg", author: "Alexander Migl", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:Dacia_Sandero_III_1X7A0329.jpg" },
  "12": { src: "/cars/12.jpg", author: "Vadim Sazanovich", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:Ford_Mustang_GT_2017.jpg" },
};
