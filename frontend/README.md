git add .
git commit -m "Update Phadam WhatsApp application"
git push origin main

##
npx prisma db push
npx prisma generate