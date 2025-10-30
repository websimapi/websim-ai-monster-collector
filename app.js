import React, { useState, useEffect, useSyncExternalStore, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { generateNewMonster } from './monster-generator.js';

const room = new WebsimSocket();
const USER_CARDS_COLLECTION = 'monster_cards_v1';

// --- React Hooks for Websim ---
function useCurrentUser() {
    const [user, setUser] = useState(null);
    useEffect(() => {
        window.websim.getCurrentUser().then(setUser);
    }, []);
    return user;
}

function useUserCards(user) {
    const filter = useMemo(() => (user ? { username: user.username } : { username: 'null' }), [user]);

    const subscribe = useCallback((callback) => {
        if (!user) return () => {};
        return room.collection(USER_CARDS_COLLECTION).filter(filter).subscribe(callback);
    }, [user, filter]);

    const getSnapshot = useCallback(() => {
        if (!user) return [];
        return room.collection(USER_CARDS_COLLECTION).filter(filter).getList();
    }, [user, filter]);

    const userRecords = useSyncExternalStore(subscribe, getSnapshot);

    return userRecords.length > 0 ? userRecords[0] : null;
}

// --- Components ---
const Card = React.memo(({ cardData, isFlipped, onClick }) => (
    <div className="card-container" onClick={onClick ? () => onClick(cardData) : undefined}>
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
            <div className="card-face card-back" style={{ backgroundImage: "url('./card-back.png')" }}></div>
            <div className="card-face card-front">
                <div className="card-image-wrapper">
                    {cardData?.imageUrl && <img src={cardData.imageUrl} alt={cardData.name} className="card-image" />}
                </div>
                <div className="card-content">
                    <h3 className="card-name">{cardData?.name || '...'}</h3>
                    <p className="card-scare-level">{cardData?.scare_level || '...'}</p>
                    <p className="card-details">{cardData?.details || '...'}</p>
                </div>
            </div>
        </div>
    </div>
));

const LoadingIndicator = ({ status }) => (
    <div className="loading-indicator">
        <p>{status}</p>
    </div>
);

const CooldownTimer = ({ lastDrawDate }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!lastDrawDate) return;

        const interval = setInterval(() => {
            const now = new Date();
            const nextDrawTime = new Date(lastDrawDate.getTime() + 24 * 60 * 60 * 1000);
            const diff = nextDrawTime - now;

            if (diff <= 0) {
                setTimeLeft('Ready to draw!');
                clearInterval(interval);
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lastDrawDate]);

    if (!timeLeft) return null;

    return <p className="cooldown-timer">{timeLeft}</p>;
};

const CardModal = ({ card, onClose }) => {
    if (!card) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <Card cardData={card} isFlipped={true} />
            </div>
        </div>
    );
};

// --- Main App Component ---
function App() {
    const user = useCurrentUser();
    const userRecord = useUserCards(user);

    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [newCard, setNewCard] = useState(null);
    const [isFlipped, setIsFlipped] = useState(false);
    const [canDraw, setCanDraw] = useState(false);
    const [lastDrawDate, setLastDrawDate] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);

    const cards = userRecord?.cards || [];

    useEffect(() => {
        if (userRecord?.lastDraw) {
            const lastDraw = new Date(userRecord.lastDraw);
            setLastDrawDate(lastDraw);
            const nextDrawTime = lastDraw.getTime() + 24 * 60 * 60 * 1000;
            setCanDraw(new Date() > nextDrawTime);
        } else {
            setCanDraw(true);
        }
    }, [userRecord]);

    const handleDrawCard = async () => {
        if (!canDraw || isLoading) return;

        setIsLoading(true);
        setNewCard(null);
        setIsFlipped(false);

        try {
            const existingNames = cards.map(c => c.name);
            const generatedCard = await generateNewMonster(existingNames, setLoadingStatus);
            setNewCard(generatedCard);

            const now = new Date().toISOString();
            if (userRecord) {
                await room.collection(USER_CARDS_COLLECTION).update(userRecord.id, {
                    cards: [...cards, generatedCard],
                    lastDraw: now,
                });
            } else {
                await room.collection(USER_CARDS_COLLECTION).create({
                    cards: [generatedCard],
                    lastDraw: now,
                });
            }

            setTimeout(() => {
                setIsFlipped(true);
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }, 500);

        } catch (error) {
            alert(error.message);
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
            setCanDraw(false);
            setLastDrawDate(new Date());
        }
    };

    const handleCardClick = (card) => {
        setSelectedCard(card);
    }

    return (
        <div className="app-container">
            <header>
                <h1>AI Monster Collector</h1>
            </header>

            <section className="draw-section">
                <button className="draw-button" onClick={handleDrawCard} disabled={!canDraw || isLoading}>
                    {isLoading ? 'Generating...' : 'Draw a Monster'}
                </button>
                {!isLoading && !canDraw && lastDrawDate && <CooldownTimer lastDrawDate={lastDrawDate} />}
                {isLoading && <LoadingIndicator status={loadingStatus} />}
            </section>

            {newCard && (
                <section className="new-card-display">
                    <Card cardData={newCard} isFlipped={isFlipped} />
                </section>
            )}

            <section className="collection-section">
                <h2>Your Collection ({cards.length})</h2>
                {cards.length === 0 && !isLoading && <p>Your collection is empty. Draw your first monster!</p>}
                <div className="card-gallery">
                    {cards.slice().reverse().map(card => (
                        <Card key={card.id} cardData={card} isFlipped={true} onClick={handleCardClick} />
                    ))}
                </div>
            </section>

            <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        </div>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);