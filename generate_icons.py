from PIL import Image, ImageDraw, ImageFont

def creer_icone(taille, nom_fichier):
    # 1. Création de l'image avec un fond bleu
    # Couleur bleu "Josué" (Royal Blue)
    couleur_fond = (0, 102, 204) 
    image = Image.new('RGB', (taille, taille), couleur_fond)
    draw = ImageDraw.Draw(image)

    # 2. Préparation du texte
    texte = "J1:8"
    
    # Tentative de chargement d'une police, sinon police par défaut
    try:
        # Sur Windows, Arial est standard. Sinon, charger une police système.
        font = ImageFont.truetype("arial.ttf", int(taille/3))
    except:
        font = ImageFont.load_default()

    # 3. Centrer le texte
    # Calcul de la position pour que ce soit bien au milieu
    bbox = draw.textbbox((0, 0), texte, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    position = ((taille - w) / 2, (taille - h) / 2.5)

    # 4. Dessiner le texte en blanc
    draw.text(position, texte, fill=(255, 255, 255), font=font)

    # 5. Sauvegarder
    image.save(nom_fichier)
    print(f"✅ Icône générée : {nom_fichier} ({taille}x{taille})")

# Génération des deux tailles requises pour la PWA
creer_icone(192, "icon-192.png")
creer_icone(512, "icon-512.png")