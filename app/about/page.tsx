export default function AboutPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <section className="max-w-4xl mx-auto px-6 py-24">
        <h1 
          className="text-5xl md:text-7xl font-black tracking-tighter mb-8"
          style={{ textWrap: 'balance' }}
        >
          About <span className="text-orange-500">JST</span>
        </h1>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="rounded-2xl overflow-hidden border border-stone-800">
            <img
              src="/images/hero-studio.jpg"
              alt="Studio mixing console with colorful LED lights"
              className="w-full h-auto object-cover"
              loading="eager"
            />
          </div>
          <div className="space-y-6">
            <p 
              className="text-xl text-stone-300 leading-relaxed"
              style={{ textWrap: 'balance' }}
            >
              JST.BEAT is a premium beat store built for artists who demand quality.
              Every instrumental is crafted with attention to detail, mixed and mastered
              ready for your vocals.
            </p>
            <p 
              className="text-stone-400 leading-relaxed"
              style={{ textWrap: 'balance' }}
            >
              From dark trap to melodic afro, the catalog covers a wide range of sounds
              inspired by the streets and the studio. Whether you need a lease or a custom
              production, JST has you covered.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="/#beats"
                className="px-8 py-3 bg-orange-600 text-white font-bold rounded-full hover:bg-orange-500 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                Browse Beats
              </a>
              <a
                href="/contact"
                className="px-8 py-3 border border-stone-700 text-stone-300 font-bold rounded-full hover:border-orange-500 hover:text-orange-300 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                Get In Touch
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}