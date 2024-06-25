import Character from './Character.js';

class GameState {
    constructor(sessionId, playerName, characterClass) {
        this.sessionId = sessionId;
        this.character = new Character(playerName, characterClass);
        this.currentScene = 'start';
    }

    updateScene(newScene) {
        this.currentScene = newScene;
    }

    toJSON() {
        return {
            sessionId: this.sessionId,
            character: this.character.toJSON(),
            currentScene: this.currentScene
        };
    }
}

export default GameState;