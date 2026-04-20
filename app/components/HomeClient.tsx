"use client";

import { useMemo, useState } from "react";
import ParallaxImage from "./ParallaxImage";
import ImageLightbox from "./ImageLightbox";
import { useLang } from "./useLang";
import { useActiveSection } from "./useActiveSection";
import { useSectionKeyboard } from "./useSectionKeyboard";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import SkipToContent from "./SkipToContent";
import ReadingProgress from "./ReadingProgress";

const SECTION_IDS = ["home", "meaning", "legacy"];

export default function HomeClient() {
  const { lang, toggleLang, isReady } = useLang();

  const content = {
    EN: {
      title: "THE COAT OF ARMS\nOF THE KARTEL FAMILY",
      intro: `The most important ideas live outside of time: they reach across generations like the light of a distant star, only now arriving at our eyes. These ideas are not about the past or the future. They are about a connection that cannot be broken. The Kartel family coat of arms tells the story of a family consciously building its present with a gaze fixed on the eternal. It reveals ideas of dignity, inner strength, and respect for oneself and one's beliefs—qualities that will pass through time and become a unifying thread for future generations.

At the center of the composition stands a heraldic shield of restrained shape. The top line—straight and firm—creates a boundary around which the heraldic elements are symmetrically arranged. The base of the shield, piercing the space like a wedge, evokes a sense of reliable foundation, as if it were embedded in the earth itself, anchoring the quiet beauty of the entire composition.

At the heart of the shield walks a griffin. Traditionally embodying superiority, protection, and foresight, this symbol is meant to guard and guide, serving as a measure of higher justice. Combining the lion and the eagle into one form, the griffin unites two forces—earthly and celestial, tangible and intangible, masculine and feminine—becoming a symbol of wholeness born of opposites. The griffin is depicted in motion, with its head held high and its wings spread behind it, like a being that never sleeps and is always ready to act, led by its heart and unwavering sense of duty.`,
      leftCol: `In its raised paw, the griffin holds a staff, reminiscent of a shepherd's crook. It alludes to Christian faith and the ancient symbol of spiritual authority—indicating not dominion, but service—to principles, beliefs, values, God, and one's calling. This is the attribute of those who are accustomed to bearing responsibility and being a guiding light for those who walk beside them.

At the base of the shield lie two crossed keys. These are both a symbol of ecclesiastical authority—historically rooted in the Apostle Peter—and a sign of deep knowledge, a touch of sacred mystery. They face each other, like two principles that complement and reinforce the union between reason and faith, earth and heaven.

Their intersection forms a cross—a sign of spirituality—and affirms belief in one's own strength. Not every door opens at once—on the contrary, the most important ones are often locked, and only a pair of keys united in one symbol can open the right one. It is a sign of hope and the possibility of transformation, a reminder that every person holds the keys to their own destiny—and only they can decide how and when to use them.

On either side of the shield extend wings, embodying silent and invisible divine protection. This image connotes trust, inner composure, and a sense of belonging to something greater than oneself. It spreads a blessing over the Kartel family, guarding against misfortune, false paths, and misguided decisions. At the same time, the wings allude to the symbolism of elite Polish cavalry, conveying a sense of power, militancy, and readiness to act with lightning speed—a message echoed by the mantling that descends beneath them, a remnant of knightly tradition, proclaiming valor and resilience in the face of trials.`,
      rightCol: `The top of the coat of arms is crowned by a coronet. Its shape elevates the entire composition, pointing the way upward—toward the heights that a person can reach through their actions and faith. But this is not a mark of birthright or feudal rank; it is not a medieval symbol of power granted by lineage. On the contrary: the image is older and deeper—it is a sign of the true qualities of a ruler: wisdom, justice, willpower, and faith in destiny. The coronet reveals the original nature of authority—granted not by blood, but by merit.

Three heraldic fleur-de-lis embody a refined symbol of purity of intention and nobility of spirit. Elegant, restrained, and strict in form, they extend the symbolism of the coronet, but from the side of moral virtues, setting the height toward which a worthy person always strives. It is a reminder that the summit belongs to those who demand the most from themselves and whose heart always preserves its original purity.

Behind the shield rise two symmetrical swords. With blades pointing upward, they symbolize readiness to stand between danger and what is dear—to stop anything that threatens the family, its principles, or its convictions. The swords express the right to act—when action becomes the only possible answer. And this right is passed down as part of the family heritage.

A curved motto ribbon bears the inscription 'Virtus et Potestas', which translates from Latin as 'Strength and Power'. These two words form the core around which the entire image of the Kartel family is built. Here, strength is the ability to go all the way, following the call of the heart and overcoming obstacles, while power is the measure of maturity, confidence, and acknowledgment of the heights attained. The motto is meant to awaken the inner will—to act decisively and to live in accordance with what one believes is right.`,
      finalLeft: `The coat of arms is executed in paired color combinations: gold (yellow) and sable (black), silver (white) and gules (red). These colors are interwoven throughout the elements of the coat of arms, forming a unique palette of meanings for the family.

The combination of gold and black reveals the contrasting pull of light and shadow. Gold reflects the noonday sun—nobility, wisdom, enlightenment, stability, greatness, loyalty, warmth, and wealth. Black, in contrast, absorbs the depth of night—willpower, endurance, humility, discipline, and the ability to remain composed under any circumstances. Together, they form a complete symbol of maturity and strength, balancing beauty with restraint, outer brilliance with inner depth.

The union of silver and red represents clarity of mind and a fiery heart. Silver carries lunar motifs—truth, virtue, sincerity, nobility, honor, openness, and intuitive insight. Red is the color of fire and inner flame: it speaks of courage, determination, passion, love, bravery, sacrifice, leadership, and strength of spirit.

This combination precisely expresses the emotional and spiritual code of the Kartel family, in which deep faith is combined with inner resolve—a readiness to go all the way and to follow a chosen path without hesitation or doubt.`,
      finalRight: `Time will move forward, changing faces and landscapes outside the window, but these ideas will remain unchanged. Each generation will rely on this symbol in its own way: some—to endure, some—to take a leap, others—to remember in moments of doubt where they come from and what strength they carry within. And at the most needed moment, it will remind them: you are not alone. Behind you stand loving people and a long family history.`,
      meaningTitle: "The Meaning of the Coat of Arms",
      legacyTitle: "Colours & Legacy",
      navHome: "Home",
      navMeaning: "Meaning",
      navLegacy: "Legacy",
      navFamily: "Family",
      namesTitle: "KARTEL FAMILY — NAMES & LEGACY",
      namesRu: [
        "Игорь Гор Картель", "Диана Картель", "Доминика Картель", "Арина Картель",
        "Игорь Каид Картель", "Феликс Картель", "Петр Картель", "Валентина Картель",
      ],
      namesEn: [
        "Igor Gor Kartel", "Diana Kartel", "Dominika Kartel", "Arina Kartel",
        "Igor Kaid Kartel", "Feliks Kartel", "Piotr Kartel", "Valentina Kartel",
      ],
      namesFooter: "KARTEL • Coat of Arms • Legacy • London",
      footerMotto: "Virtus et Potestas",
      footerCopy: "The Kartel Family. London.",
    },
    RU: {
      title: "ФАМИЛЬНЫЙ ГЕРБ\nСЕМЬИ КАРТЕЛЬ",
      intro: `Самые важные идеи живут вне времени: они протягивают руку через поколения, как свет далёкой звезды, дошедший до нас только сейчас. Они — не о прошлом и не о будущем. Они — о связи, которую невозможно разорвать. Фамильный герб Картель рассказывает о семье, осознанно строящей своё настоящее с оглядкой на вечное. Он раскрывает идеи достоинства, внутренней силы, уважения к себе и своим убеждениям, которые пройдут сквозь время и станут связующим звеном для будущих поколений.

Центром композиции выступает геральдический щит лаконичной формы. Верхняя линия — прямая и устойчивая — образует границу, вокруг которой симметрично выстраиваются гербовые элементы. Основание щита, клином врезающееся в пространство, создаёт ощущение надёжной опоры, словно он вонзён в землю, закрепляя собой сдержанную красоту всей композиции.

Сердце щита занимает шествующий грифон. Традиционно олицетворяя превосходство, защиту и дальновидность, этот символ призван оберегать, направлять, и тем самым служить мерилом высшей справедливости. Он объединяет в себе два начала, льва и орла, сливая в одном облике земное и небесное, осязаемое и бестелесное, мужское и женское. Грифон изображён в движении, с поднятой головой и крыльями, распахнутыми за спиной, — как тот, кто никогда не спит и готов действовать, ведомый собственным сердцем и неугасимым чувством долга.`,
      leftCol: `В поднятой лапе грифона находится жезл, близкий по форме к посоху пастыря. Он отсылает к христианской вере и древнему символу духовной власти, указывающему не на господство, а на служение — принципам, убеждениям, ценностям, Богу и своему предназначению. Это атрибут людей, которые привыкли брать на себя ответственность и быть ориентиром для идущих рядом.

Основание щита содержит два скрещённых ключа. Это одновременно символ церковной власти, исторически восходящий к апостолу Петру, и знак глубоких знаний, прикосновения к сокровенной тайне. Они обращены навстречу друг другу — как два начала, дополняющие и усиливающие союз между разумом и верой, земным и небесным.

Их пересечение не только образует крест — знак духовности, но и служит утверждением веры в собственные силы. Не каждая дверь распахивается сразу — напротив, самые важные оказываются запертыми, и лишь парные ключи, соединённые в одном символе, способны открыть нужную дверь. Это знак надежды и возможности преображения, напоминание о том, что каждый человек владеет ключами от собственной судьбы — и только от него зависит, как и когда он ими воспользуется.

С обеих сторон щита раскинулись крылья, воплощая безмолвное и незримое божественное покровительство. Образ соединяет доверие, внутреннюю собранность и принадлежность к чему-то большему, чем ты сам. Он простирает над семьёй Картель благословляющую силу, охраняющую от невзгод, неверных решений и ложных, запутанных путей. Вместе с тем крылья отсылают к символике элитной польской кавалерии, передавая смысл силы, воинственности и готовности молниеносно действовать, чему вторит и спадающий под ними намёт — отголосок рыцарской традиции, провозглашающий доблесть и стойкость под натиском испытаний.`,
      rightCol: `Верхнюю часть герба венчает корона. Её форма возвышает композицию, задавая направление — к вершинам, которых человек способен достичь своими поступками и верой. Но это не признак происхождения или сословной иерархии, не средневековый символ власти, даруемый по праву рождения. Напротив, образ древнее и глубже — это знак качеств истинного правителя: мудрости, справедливости, силы воли и веры в предназначение. Корона раскрывает изначальную природу власти, даруемой не по крови, а по достоинству.

Три геральдические лилии воплощают утончённый символ чистоты помыслов и возвышенности духа. Изящные, сдержанные и строгие по форме, они продолжают образ короны, но уже со стороны нравственных добродетелей, задавая высоту, к которой всегда стремится достойный человек. Это напоминание о том, что вершина принадлежит тем, кто предъявляет самые высокие требования прежде всего к себе и чьё сердце всегда сохраняет первозданную чистоту.

За щитом возвышаются два симметричных меча. Клинки, направленные вверх, обозначают готовность встать между опасностью и тем, что дорого, способность остановить всё, что посягает на семью, на принципы и убеждения. Мечи выражают право на действие — когда поступок становится единственным возможным ответом. И это право передаётся дальше как часть семейного наследия.

Изогнутая девизная лента содержит надпись «Virtus et Potestas», что переводится с латыни как «Сила и Власть». Эти два слова составляют стержень, вокруг которого выстраивается весь образ семьи Картель. Здесь сила — это способность идти до конца, следуя зову сердца и преодолевая преграды, а власть — мерило зрелости, уверенности и признания достигнутых высот. Девиз призван пробуждать внутреннюю волю, чтобы действовать решительно и жить в соответствии с тем, что считаешь правильным.`,
      finalLeft: `Герб выполнен парным сочетанием цветов: золото (жёлтый) и чернь (чёрный), серебро (белый) и червлень (красный). Они переплетаются в элементах герба, формируя особую для семьи палитру смыслов.

В соединении золотого и чёрного раскрывается контрастное притяжение света и тени. Золото отражает полуденное солнце, благородство, мудрость, просвещённость, стабильность, величие, верность, теплоту и богатство. Чёрный, напротив, вбирает в себя глубину ночи, волю, стойкость, скромность, дисциплину и способность сохранять хладнокровие в любых обстоятельствах. Вместе они образуют цельный символ зрелости и силы, уравновешивая красоту и сдержанность, внешнее сияние и внутреннюю глубину.

Сочетание серебряного и красного цветов отражает ясность ума и горячее сердце. Серебро несёт в себе лунные мотивы — символику истины, добродетели, искренности, благородства, чести, открытости и интуитивной проницательности. Красный — цвет огня и внутреннего жара: он говорит об отваге, решительности, страсти, любви, мужестве, жертвенности, лидерстве, силе духа.

Эта связка особенно точно выражает эмоциональный и духовный код Картель, в котором глубокая вера сочетается с внутренней решимостью, готовностью идти до конца и следовать однажды выбранному пути без колебаний и сомнений.`,
      finalRight: `Время будет бежать вперёд, меняя лица и ландшафты за окном, но идеи останутся неизменными. Каждое поколение будет опираться на этот символ по-своему: кто-то — чтобы устоять, кто-то — чтобы решиться, кто-то — чтобы в минуты сомнений вспомнить, откуда он родом и какую силу несёт в себе. И в самый нужный момент он напомнит: ты не один. За твоей спиной — любящие люди и длинная семейная история.`,
      meaningTitle: "Символика герба",
      legacyTitle: "Цвета и наследие",
      navHome: "Главная",
      navMeaning: "Смысл",
      navLegacy: "Наследие",
      navFamily: "Семья",
      namesTitle: "СЕМЬЯ КАРТЕЛЬ — ИМЕНА И НАСЛЕДИЕ",
      namesRu: [
        "Игорь Гор Картель", "Диана Картель", "Доминика Картель", "Арина Картель",
        "Игорь Каид Картель", "Феликс Картель", "Петр Картель", "Валентина Картель",
      ],
      namesEn: [
        "Igor Gor Kartel", "Diana Kartel", "Dominika Kartel", "Arina Kartel",
        "Igor Kaid Kartel", "Feliks Kartel", "Piotr Kartel", "Valentina Kartel",
      ],
      namesFooter: "КАРТЕЛЬ • герб • наследие • Лондон",
      footerMotto: "Virtus et Potestas",
      footerCopy: "Семья Картель. Лондон.",
    },
  };

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const t = content[lang];
  const activeSection = useActiveSection(SECTION_IDS);
  useSectionKeyboard(SECTION_IDS);

  const navItems = useMemo(() => [
    { label: t.navHome, href: "#home", active: activeSection === "home" },
    { label: t.navMeaning, href: "#meaning", active: activeSection === "meaning" },
    { label: t.navLegacy, href: "#legacy", active: activeSection === "legacy" },
    { label: t.navFamily, href: `/family?lang=${lang}` },
  ], [t, activeSection, lang]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eeebe5]">
        <span className="font-serif text-[24px] tracking-[0.12em] text-[#9b723a] sm:text-[28px]">
          KARTEL
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eeebe5] text-[#2b2824]">
      <ReadingProgress />
      <SkipToContent />
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={navItems} />

      <main id="main-content" role="main">
        {/* Hero */}
        <article id="home" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
            <FadeInSection>
              <h1 className="whitespace-pre-line text-center font-serif text-[28px] leading-[1.2] text-[#9b723a] sm:text-[38px] lg:text-left lg:text-[58px]">
                {t.title}
              </h1>
              <div className="mt-8 flex justify-center lg:justify-start">
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="cursor-zoom-in rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9b723a]"
                  aria-label="View coat of arms full size"
                >
                  <ParallaxImage
                    src="/crest.jpeg"
                    alt="Kartel family coat of arms — Virtus et Potestas"
                    width={540}
                    height={540}
                    priority
                    speed={0.06}
                    className="w-full max-w-[280px] object-contain sm:max-w-[380px] lg:max-w-[540px]"
                  />
                </button>
              </div>
            </FadeInSection>

            <FadeInSection>
              <div className="drop-cap max-w-[700px] text-[16px] leading-[1.75] text-[#37332e] sm:text-[18px] lg:text-[22px] lg:leading-[1.65]">
                {t.intro.split("\n\n").map((p, idx) => (
                  <p key={idx} className="mb-5 text-left">{p}</p>
                ))}
              </div>
            </FadeInSection>
          </div>
        </article>

        <HeraldicDivider />

        {/* Meaning */}
        <section id="meaning" className="border-t border-[#d7d1c7]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            <FadeInSection>
              <h2 className="mb-8 font-serif text-[22px] leading-[1.2] text-[#9b723a] sm:text-[28px] lg:mb-12 lg:text-[36px]">
                {t.meaningTitle}
              </h2>
            </FadeInSection>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[#3a3630] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.leftCol.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
                  ))}
                </div>
              </FadeInSection>
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[#3a3630] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.rightCol.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
                  ))}
                </div>
              </FadeInSection>
            </div>
          </div>
        </section>

        <HeraldicDivider />

        {/* Legacy */}
        <section id="legacy" className="border-t border-[#d7d1c7]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            <FadeInSection>
              <h2 className="mb-8 font-serif text-[22px] leading-[1.2] text-[#9b723a] sm:text-[28px] lg:mb-12 lg:text-[36px]">
                {t.legacyTitle}
              </h2>
            </FadeInSection>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[#3a3630] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.finalLeft.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
                  ))}
                </div>
              </FadeInSection>
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[#3a3630] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.finalRight.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
                  ))}
                </div>
              </FadeInSection>
            </div>
          </div>
        </section>

        <HeraldicDivider />

        {/* Names */}
        <aside className="border-t border-[#d7d1c7]" aria-label={lang === "EN" ? "Family names" : "Имена семьи"}>
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
            <FadeInSection>
              <h3 className="mb-6 text-center font-serif text-[18px] tracking-wide text-[#9b723a] sm:text-[20px] lg:text-[22px]">
                {t.namesTitle}
              </h3>
              <div className="grid gap-6 text-center text-[14px] leading-[1.9] text-[#3a3630] sm:text-[15px] md:grid-cols-2 lg:text-[16px]">
                <div>{t.namesRu.map((name) => (<p key={name}>{name}</p>))}</div>
                <div>{t.namesEn.map((name) => (<p key={name}>{name}</p>))}</div>
              </div>
              <p className="mt-8 text-center text-[12px] tracking-[0.08em] text-[#6f685c] sm:text-[13px] lg:text-[14px]">
                {t.namesFooter}
              </p>
            </FadeInSection>
          </div>
        </aside>
      </main>

      <SiteFooter motto={t.footerMotto} copy={t.footerCopy} />
      <BackToTop />
      <ImageLightbox
        src="/crest.jpeg"
        webpSrc="/crest.webp"
        alt="Kartel family coat of arms — Virtus et Potestas"
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
