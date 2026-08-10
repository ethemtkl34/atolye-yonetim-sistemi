-- Pasif soruların tamamı siliniyor (kurum kararı, 11 Ağustos 2026).
--
-- Bunlar ilk karneden kalan ve 8 Ağustos'ta gerçek soru setleriyle
-- değiştirilirken cevabı olduğu için silinmeyip pasife alınmış 50 soru.
-- Silmek geçmişi bozmaz: ScoreAnswer.questionId `onDelete: SetNull` ile
-- boşa düşer, geçmiş formlar ve raporlar puanlama anında dondurulan
-- questionTextSnapshot / titleSnapshot / categorySnapshot kopyalarından
-- görüntülenmeye devam eder (§13.14 bu senaryo için kuruldu).
--
-- Yan etki — bilinçli: bu cevapların categorySnapshot'ı boş olduğu için
-- kategori bilgisi soru satırından okunuyordu; bağ kopunca o eski cevaplar
-- ilgi/başarı kademe ortalamalarının dışında kalır. Bu, 8 Ağustos öncesi
-- davranışın aynısı — kategorisiz dönemin verisi kademe hesabına hiç
-- girmiyordu.
--
-- Tekrar çalıştırmaya dayanıklı: ikinci çalıştırmada silinecek satır kalmaz.

DELETE FROM "Question" WHERE NOT "active";
