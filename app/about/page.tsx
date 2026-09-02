import { FaWhatsapp, FaInstagram, FaEnvelope, FaTiktok, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import { getProducers } from '@/lib/get-producers';
import Link from 'next/link';
import Image from 'next/image';

// Without this, Next prerenders the producers list once at build time and
// bakes it into static HTML — a profile edit from the dashboard wouldn't
// show up on the live site until the next deploy. Revalidate hourly
// instead: cheap (bios change rarely) but still reflects real edits.
export const revalidate = 3600;

export default async function AboutPage() {
  const producers = await getProducers();

  return (
    <div className="bg-black text-white min-h-screen">
      <section className="max-w-4xl mx-auto px-6 py-24">
        <h1
          className="text-5xl md:text-7xl font-black tracking-tighter mb-8"
          style={{ textWrap: 'balance' }}
        >
          About JST<span className="text-orange-500">.</span>BEAT
        </h1>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-[3/2] rounded-2xl overflow-hidden border border-stone-800">
            <Image
              src="/images/hero-studio.jpg"
              alt="Studio mixing console with colorful LED lights"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
          <div className="space-y-6">
            <p
              className="text-xl text-stone-300 leading-relaxed"
              style={{ textWrap: 'balance' }}
            >
              I&apos;m <span className="text-orange-400 font-bold">jst.dan</span>. I started
              JST.BEAT because I was tired of my beats living as scattered links with
              no real home. I brought in <span className="text-orange-400 font-bold">tisco prodz</span>{' '}
              as co-founder, and now it&apos;s one store — each of us running our own
              catalog.
            </p>
            <p
              className="text-stone-400 leading-relaxed"
              style={{ textWrap: 'balance' }}
            >
              We do everything from dark trap to melodic afro. Every beat is mixed
              and mastered, so you just add vocals and go. Need something custom?
              Hit us up.
            </p>
            <p
              className="text-stone-500 text-sm leading-relaxed"
              style={{ textWrap: 'balance' }}
            >
              Store&apos;s coming soon too — that&apos;s where we&apos;ll drop our own songs,
              not just beats.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/beats"
                className="px-8 py-3 bg-orange-600 text-white font-bold rounded-full hover:bg-orange-500 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                Browse Beats
              </Link>
              <a
                href="#producers"
                className="px-8 py-3 border border-stone-700 text-stone-300 font-bold rounded-full hover:border-orange-500 hover:text-orange-300 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                Get In Touch
              </a>
            </div>
          </div>
        </div>

        {/* Producers */}
        <div id="producers" className="mt-24 scroll-mt-20">
          <h2 className="text-3xl font-black tracking-tighter mb-8">
            The <span className="text-orange-500">Producers</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {producers.map((p) => (
              <div key={p.name} className="border border-stone-800 rounded-2xl p-6 bg-stone-900/40">
                <div className="flex items-center gap-4 mb-3">
                  {p.photo_url ? (
                    <Image
                      src={p.photo_url}
                      alt=""
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover border border-stone-700"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-stone-800 flex items-center justify-center text-stone-500 text-xl font-bold border border-stone-700">
                      {p.name[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-orange-100">{p.name}</h3>
                    <p className="text-xs text-stone-500">
                      {p.name === 'jst.dan' ? 'Founder' : 'Co-founder'}
                      {p.full_name ? ` · ${p.full_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-stone-400">
                  {p.whatsapp && (
                    <a
                      href={`https://wa.me/254${p.whatsapp.replace(/^0/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none w-fit"
                    >
                      <FaWhatsapp className="text-green-500" /> {p.whatsapp}
                    </a>
                  )}
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      className="flex items-center gap-2 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none w-fit"
                    >
                      <FaEnvelope /> {p.email}
                    </a>
                  )}
                  {p.instagram && (
                    <a
                      href={`https://instagram.com/${p.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none w-fit"
                    >
                      <FaInstagram /> @{p.instagram}
                    </a>
                  )}
                  {p.tiktok && (
                    <a
                      href={`https://tiktok.com/@${p.tiktok}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none w-fit"
                    >
                      <FaTiktok /> @{p.tiktok}
                    </a>
                  )}
                  {p.twitter && (
                    <a
                      href={`https://x.com/${p.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none w-fit"
                    >
                      <FaXTwitter /> @{p.twitter}
                    </a>
                  )}
                  {p.youtube && /^https?:\/\//.test(p.youtube) && (
                    <a
                      href={p.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none w-fit"
                    >
                      <FaYoutube /> YouTube
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
