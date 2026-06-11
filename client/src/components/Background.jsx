import React from 'react';

const Background = () => {
    return (
        <div className="absolute inset-0 bg-black overflow-hidden -z-20">
            {/* Base dark layer */}
            <div className="absolute inset-0 bg-slate-950"></div>

            {/* Overlay for cinematic mood */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-40"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-40"></div>
        </div>
    );
};

export default Background;
