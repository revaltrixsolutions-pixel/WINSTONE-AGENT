git add .
git commit -m "Update Winston Medical Centre application"
git push origin main

##
npx prisma db push
npx prisma generate