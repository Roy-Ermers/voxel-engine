import alea from 'alea';

interface PrngFactory {
    new(seed?: string | number): () => number;
}

const Random: PrngFactory = (alea as unknown) as PrngFactory;

export default Random;