# Board Game Bros (BGB)

Welcome to **Board Game Bros (BGB)** — a medieval-themed board game club website designed to document our weekly activities, maintain our game library, and track board game news & crowdfunding updates.

This repository hosts the source code of the official BGB website.

---

## 🏰 Project Structure

```
/
├── index.html          # Main website entry page
├── main.css            # Global styles (medieval parchment theme)
├── main.js             # Future scripts / dynamic behavior
├── assets/
│   ├── icon/           # Logos and icons (ex: BGB.png)
│   ├── games/          # Board game cover images
│   ├── daily/          # Weekly event photos
│   └── misc/           # Other static resources
└── README.md
```

---

## 🌟 Features

### ✔ Home Page  
Introduction to the club and quick access to key sections.

### ✔ Game Library  
A visual catalog of all board games owned by BGB.  
Each entry may include:
- Game name  
- Player count  
- Category (Strategy, Eurogame, Party, etc.)
- Play time  
- Complexity  
- Status (in library / borrowed / new arrival)

### ✔ News  
A section dedicated to:
- Latest board game releases  
- Kickstarter & Gamefound crowdfunding updates  
- Notable hobby news  

### ✔ Weekly Events (Daily Page)  
A photo log of our weekly meetups including:
- Event photos  
- Match results  
- Attendance  
- Featured games

---

## 🎨 Design Style

The entire website follows a **medieval parchment aesthetic**:
- Warm beige parchment background  
- Deep brown typography  
- Logo featuring monk & knight  
- Castle and scroll motifs  
- Textured handmade illustration style  

---

## 🚀 How to Run Locally

No build tools required — this is a pure static site.

1. Clone the repository:
   ```bash
   git clone https://github.com/AnthonyZhangYan/boardgamebros.git
   ```
2. Open the project folder:
   ```bash
   cd boardgamebros
   ```
3. Open `index.html` in any browser.

Optional (live preview):

```bash
python3 -m http.server
# visit http://localhost:8000
```

---

## 📸 Adding Content

### Add new game cover:
```
assets/games/
```

### Add weekly event photos:
```
assets/daily/
```

### Update library or event info:
Edit `index.html` directly.

---

## 🔧 Future Improvements

Planned enhancements:
- Game ratings  
- Borrowing / inventory system  
- Event signup  
- Automated news + crowdfunding scraping  
- Multi-page version  
- Dark mode (torch-light medieval style)  

---

## 📜 License

This project is for personal/club use.  
If you need a formal open-source license (MIT, Apache-2.0, GPL), I can generate one.

---

## 🤝 Contributions

Internal contributions from BGB members are welcome.  
Pull requests and ideas are appreciated.

---

## 🛡️ Board Game Bros (BGB)

Bringing people together through tabletop adventures — one quest at a time.
