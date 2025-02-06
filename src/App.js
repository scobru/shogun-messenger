import React, { useEffect, useState } from "react";
import { UnstoppableChat } from "@scobru/shogun";
import './App.css';

const App = () => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeContact, setActiveContact] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

  // Stati per autenticazione
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    username: "",
    password: "",
    publicName: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Nuovi stati per la gestione delle modal
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ name: '', isPrivate: false });
  const [newContactForm, setNewContactForm] = useState({ username: '', pubKey: '', name: '' });
  const [newAnnouncementForm, setNewAnnouncementForm] = useState({ 
    name: '', 
    isPrivate: false,
    rssLink: '' 
  });

  // Aggiungi stato per mostrare/nascondere il modal della chiave pubblica
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [userPublicKey, setUserPublicKey] = useState('');

  const [publicChannels, setPublicChannels] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPublicChannels, setShowPublicChannels] = useState(false);

  useEffect(() => {
    try {
      const superpeers = ["http://localhost:8765/gun"];
      const unstoppableChat = new UnstoppableChat(superpeers);
      
      // Verifica che l'istanza sia stata creata correttamente
      if (!unstoppableChat || !unstoppableChat.gun) {
        throw new Error("Errore nell'inizializzazione della chat");
      }
      
      setChat(unstoppableChat);
    } catch (error) {
      console.error("Errore nell'inizializzazione:", error);
      setAuthError("Errore nella connessione al server");
    }
  }, []);

  useEffect(() => {
    if (!chat) return;

    // Carica i canali pubblici
    const publicStream = chat.loadPublicChannels();
    publicStream.on((channelList) => {
      setPublicChannels(channelList);
    });
  }, [chat]);

  // Gestione form di autenticazione
  const handleAuthInputChange = (e) => {
    setAuthForm({
      ...authForm,
      [e.target.name]: e.target.value,
    });
  };

  // Gestione registrazione
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!chat) return;

    try {
      await chat.gun.user().create(
        authForm.username,
        authForm.password,
        (ack) => {
          if (ack.err) {
            setAuthError(ack.err);
            return;
          }
          // Procedi con il login dopo la registrazione
          handleLogin(e);
        }
      );
    } catch (error) {
      setAuthError("Errore durante la registrazione: " + error.message);
    }
  };

  // Gestione login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!chat) return;

    try {
      await chat.join(authForm.username, authForm.password, authForm.publicName);
      setIsLoggedIn(true);
      setAuthError("");
      
      // Salva la chiave pubblica dell'utente
      const publicKey = chat.gun.user().is.pub;
      setUserPublicKey(publicKey);

      // Caricamento dati con gestione degli errori
      try {
        const [contactsStream, channelsStream, announcementsStream] = await Promise.all([
          chat.loadContacts(),
          chat.loadChannels(),
          chat.loadAnnouncements()
        ]);

        if (contactsStream?.on) {
          contactsStream.on((contactsList) => setContacts(contactsList));
        }

        if (channelsStream?.on) {
          channelsStream.on((channelsList) => setChannels(channelsList));
        }

        if (announcementsStream?.on) {
          announcementsStream.on((announcementsList) => setAnnouncements(announcementsList));
        }
      } catch (error) {
        console.error("Errore nel caricamento dei dati:", error);
      }
    } catch (error) {
      setAuthError("Errore durante il login: " + error.message);
    }
  };

  // Gestione logout
  const handleLogout = async () => {
    if (!chat) return;
    await chat.logout();
    setIsLoggedIn(false);
    setContacts([]);
    setChannels([]);
    setAnnouncements([]);
    setMessages([]);
  };

  // Form di autenticazione
  const renderAuthForm = () => (
    <div className="auth-container">
      <h2>{isRegistering ? "Registrazione" : "Login"}</h2>
      <form onSubmit={isRegistering ? handleRegister : handleLogin}>
        <div className="form-group">
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={authForm.username}
            onChange={handleAuthInputChange}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={authForm.password}
            onChange={handleAuthInputChange}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="text"
            name="publicName"
            placeholder="Nome pubblico"
            value={authForm.publicName}
            onChange={handleAuthInputChange}
            required
          />
        </div>
        {authError && <div className="auth-error">{authError}</div>}
        <button type="submit">
          {isRegistering ? "Registrati" : "Accedi"}
        </button>
      </form>
      <button
        className="switch-auth"
        onClick={() => setIsRegistering(!isRegistering)}
      >
        {isRegistering
          ? "Hai già un account? Accedi"
          : "Non hai un account? Registrati"}
      </button>
    </div>
  );

  // Gestione invio messaggi
  const handleSendMessage = async () => {
    if (!chat || !newMessage) return;

    try {
      if (activeContact) {
        await chat.sendMessageToContact(activeContact, newMessage);
      } else if (activeChannel) {
        const channel = channels.find(c => c.key === activeChannel);
        if (channel) {
          await chat.sendMessageToChannel(channel, newMessage, {
            pubKey: chat.gun.user().is.pub,
            alias: chat.gun.user().is.alias,
            name: chat.publicName,
            action: 'message'
          });
        }
      } else if (activeAnnouncement) {
        const announcement = announcements.find(a => a.key === activeAnnouncement);
        if (announcement) {
          await chat.sendMessageToAnnouncement(announcement, newMessage, {
            pubKey: chat.gun.user().is.pub,
            alias: chat.gun.user().is.alias,
            name: chat.publicName,
            action: 'message'
          });
        }
      }
      setNewMessage("");
    } catch (error) {
      console.error("Errore nell'invio del messaggio:", error);
    }
  };

  // Gestione selezione contatto
  const handleContactSelect = async (pubKey) => {
    setActiveContact(pubKey);
    setActiveChannel(null);
    setActiveAnnouncement(null);
    
    const contact = contacts.find(c => c.pubKey === pubKey);
    if (contact && chat) {
      try {
        const messageStream = await chat.loadMessagesOfContact(pubKey, contact.name);
        if (messageStream?.on) {
          messageStream.on((messagesList) => {
            setMessages(messagesList);
          });
        }
      } catch (error) {
        console.error("Errore nel caricamento dei messaggi:", error);
      }
    }
  };

  // Gestione selezione canale
  const handleChannelSelect = async (channelKey) => {
    try {
      if (!chat) return;

      setActiveChannel(channelKey);

      // Trova il canale selezionato
      const selectedChannel = channels.find(c => c.key === channelKey) || 
                            publicChannels.find(c => c.key === channelKey);

      if (!selectedChannel) {
        console.error('Canale non trovato');
        return;
      }

      // Carica i messaggi del canale
      const messageStream = await chat.loadMessagesOfChannel(selectedChannel);
      messageStream.on((messages) => {
        setMessages(messages);
      });

    } catch (error) {
      console.error('Errore nella selezione del canale:', error);
    }
  };

  // Gestione selezione annuncio
  const handleAnnouncementSelect = async (announcementKey) => {
    setActiveAnnouncement(announcementKey);
    setActiveContact(null);
    setActiveChannel(null);

    const announcement = announcements.find(a => a.key === announcementKey);
    if (announcement && chat) {
      try {
        const messageStream = await chat.loadMessagesOfAnnouncement(announcement);
        if (messageStream?.on) {
          messageStream.on((messagesList) => {
            setMessages(messagesList);
          });
        }
      } catch (error) {
        console.error("Errore nel caricamento degli annunci:", error);
      }
    }
  };

  // Gestione creazione canale
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    try {
      const channel = await chat.createChannel(
        newChannelForm.name,
        newChannelForm.isPrivate
      );
      setChannels([...channels, channel]);
      setShowNewChannelModal(false);
      setNewChannelForm({ name: '', isPrivate: false });
    } catch (error) {
      console.error("Errore nella creazione del canale:", error);
    }
  };

  // Gestione aggiunta contatto
  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!chat || !chat.gun || !chat.gun.user().is) {
      console.error("Chat non inizializzata correttamente");
      return;
    }

    try {
      // Verifica che tutti i campi siano compilati
      if (!newContactForm.username || !newContactForm.pubKey || !newContactForm.name) {
        throw new Error("Tutti i campi sono obbligatori");
      }

      // Verifica formato della chiave pubblica
      if (!newContactForm.pubKey.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
        throw new Error("Formato chiave pubblica non valido");
      }

      // Prima verifica se l'utente esiste
      const user = await new Promise((resolve) => {
        chat.gun.user(newContactForm.pubKey).once((user) => {
          if (!user) {
            resolve(null);
          } else {
            resolve(user);
          }
        });
      });

      if (!user) {
        throw new Error("Utente non trovato");
      }

      // Aggiungi il contatto
      const contact = await chat.addContact(
        newContactForm.username,
        newContactForm.pubKey,
        newContactForm.name
      );

      // Aggiorna la lista dei contatti solo se l'aggiunta è avvenuta con successo
      if (contact) {
        setContacts(prevContacts => [...prevContacts, contact]);
        setShowNewContactModal(false);
        setNewContactForm({ username: '', pubKey: '', name: '' });
        setAuthError(''); // Pulisci eventuali errori precedenti
      }
    } catch (error) {
      console.error("Errore nell'aggiunta del contatto:", error);
      setAuthError(`Errore nell'aggiunta del contatto: ${error.message}`);
    }
  };

  // Gestione creazione annuncio
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const announcement = await chat.createAnnouncement(
        newAnnouncementForm.name,
        newAnnouncementForm.isPrivate,
        newAnnouncementForm.rssLink
      );
      setAnnouncements([...announcements, announcement]);
      setShowNewAnnouncementModal(false);
      setNewAnnouncementForm({ name: '', isPrivate: false, rssLink: '' });
    } catch (error) {
      console.error("Errore nella creazione dell'annuncio:", error);
    }
  };

  // Componenti Modal
  const NewChannelModal = () => (
    <div className="modal">
      <div className="modal-content">
        <h3>Crea nuovo canale</h3>
        <form onSubmit={handleCreateChannel}>
          <input
            type="text"
            placeholder="Nome canale"
            value={newChannelForm.name}
            onChange={(e) => setNewChannelForm({...newChannelForm, name: e.target.value})}
          />
          <label>
            <input
              type="checkbox"
              checked={newChannelForm.isPrivate}
              onChange={(e) => setNewChannelForm({...newChannelForm, isPrivate: e.target.checked})}
            />
            Privato
          </label>
          <button type="submit">Crea</button>
          <button type="button" onClick={() => setShowNewChannelModal(false)}>Annulla</button>
        </form>
      </div>
    </div>
  );

  const NewContactModal = () => (
    <div className="modal">
      <div className="modal-content">
        <h3>Aggiungi contatto</h3>
        <div className="modal-instructions">
          <p>Per aggiungere un contatto hai bisogno di:</p>
          <ul>
            <li>Username dell'utente</li>
            <li>Chiave pubblica dell'utente</li>
            <li>Un nome per identificare il contatto</li>
          </ul>
        </div>
        {authError && <div className="auth-error">{authError}</div>}
        <form onSubmit={handleAddContact}>
          <input
            type="text"
            placeholder="Username"
            value={newContactForm.username}
            onChange={(e) => setNewContactForm({...newContactForm, username: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Chiave pubblica"
            value={newContactForm.pubKey}
            onChange={(e) => setNewContactForm({...newContactForm, pubKey: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Nome da visualizzare"
            value={newContactForm.name}
            onChange={(e) => setNewContactForm({...newContactForm, name: e.target.value})}
            required
          />
          <div className="modal-buttons">
            <button type="submit">Aggiungi</button>
            <button 
              type="button" 
              onClick={() => {
                setShowNewContactModal(false);
                setAuthError('');
                setNewContactForm({ username: '', pubKey: '', name: '' });
              }}
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const NewAnnouncementModal = () => (
    <div className="modal">
      <div className="modal-content">
        <h3>Crea nuovo annuncio</h3>
        <form onSubmit={handleCreateAnnouncement}>
          <input
            type="text"
            placeholder="Nome annuncio"
            value={newAnnouncementForm.name}
            onChange={(e) => setNewAnnouncementForm({...newAnnouncementForm, name: e.target.value})}
          />
          <label>
            <input
              type="checkbox"
              checked={newAnnouncementForm.isPrivate}
              onChange={(e) => setNewAnnouncementForm({...newAnnouncementForm, isPrivate: e.target.checked})}
            />
            Privato
          </label>
          <input
            type="text"
            placeholder="RSS Link (opzionale)"
            value={newAnnouncementForm.rssLink}
            onChange={(e) => setNewAnnouncementForm({...newAnnouncementForm, rssLink: e.target.value})}
          />
          <button type="submit">Crea</button>
          <button type="button" onClick={() => setShowNewAnnouncementModal(false)}>Annulla</button>
        </form>
      </div>
    </div>
  );

  // Componente Modal per mostrare la chiave pubblica
  const PublicKeyModal = () => (
    <div className="modal">
      <div className="modal-content">
        <h3>La tua Chiave Pubblica</h3>
        <div className="public-key-container">
          <p>Username: {authForm.username}</p>
          <p>Chiave Pubblica: {userPublicKey}</p>
          <button onClick={() => {
            navigator.clipboard.writeText(userPublicKey);
          }}>Copia Chiave</button>
        </div>
        <button onClick={() => setShowPublicKeyModal(false)}>Chiudi</button>
      </div>
    </div>
  );

  // Funzione per entrare in un canale pubblico
  const handleJoinPublicChannel = async (channel) => {
    try {
      if (!chat || !chat.gun.user().is) {
        console.error("Utente non autenticato");
        return;
      }

      console.log("Tentativo di entrare nel canale:", channel.name);

      // Entra nel canale pubblico
      await chat.joinPublicChannel(channel);
      
      // Crea una copia del canale con le proprietà necessarie
      const newChannel = {
        ...channel,
        peers: channel.peers || {},
        isPrivate: false,
        disabled: false
      };

      // Aggiorna manualmente la lista dei canali
      setChannels(prevChannels => {
        // Verifica se il canale esiste già
        const existingChannel = prevChannels.find(c => c.key === channel.key);
        if (!existingChannel) {
          console.log("Aggiunto nuovo canale:", newChannel.name);
          return [...prevChannels, newChannel];
        }
        return prevChannels;
      });

      // Seleziona il canale
      setActiveChannel(channel.key);
      setActiveContact(null);
      setActiveAnnouncement(null);
      
      // Carica i messaggi del canale
      try {
        const messageStream = await chat.loadMessagesOfChannel(channel);
        if (messageStream?.on) {
          messageStream.on((messages) => {
            console.log("Messaggi caricati:", messages);
            setMessages(messages);
          });
        }
      } catch (msgError) {
        console.error("Errore nel caricamento dei messaggi:", msgError);
      }

      setShowPublicChannels(false); // Chiudi la modale
      
      // Aggiorna la lista dei canali dopo un breve delay per assicurarsi che il canale sia stato aggiunto
      setTimeout(async () => {
        const channelsStream = chat.loadChannels();
        if (channelsStream?.on) {
          channelsStream.on((channelList) => {
            setChannels(channelList);
          });
        }
      }, 1000);

    } catch (error) {
      console.error("Errore nell'entrare nel canale:", error);
    }
  };

  // Componente per la lista dei canali pubblici
  const PublicChannelsList = () => (
    <div className="modal">
      <div className="modal-content">
        <h3>Canali Pubblici</h3>
        <input
          type="text"
          placeholder="Cerca canali..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="public-channels-list">
          {publicChannels
            .filter(channel => 
              channel.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map(channel => (
              <div key={channel.key} className="public-channel-item">
                <div className="channel-info">
                  <span className="channel-name">{channel.name}</span>
                  <span className="user-count">
                    {Object.keys(channel.peers || {}).length} utenti
                  </span>
                </div>
                <button 
                  onClick={() => handleJoinPublicChannel(channel)}
                  className="join-button"
                >
                  Entra
                </button>
              </div>
            ))}
        </div>
        <button onClick={() => setShowPublicChannels(false)}>Chiudi</button>
      </div>
    </div>
  );

  // Se non è loggato, mostra il form di autenticazione
  if (!isLoggedIn) {
    return renderAuthForm();
  }

  // Interfaccia chat principale
  return (
    <div className="app">
      <div className="sidebar">
        <div className="user-info">
          <div>
            <span>Benvenuto, {authForm.publicName}</span>
            <button 
              className="show-key-btn"
              onClick={() => setShowPublicKeyModal(true)}
            >
              Mostra Chiave
            </button>
          </div>
          <button onClick={handleLogout}>Logout</button>
        </div>

        <div className="contacts">
          <div className="section-header">
            <h2>Contatti</h2>
            <button onClick={() => setShowNewContactModal(true)}>+</button>
          </div>
          {contacts.map((contact) => (
            <div
              key={contact.pubKey}
              onClick={() => handleContactSelect(contact.pubKey)}
              className={activeContact === contact.pubKey ? "active" : ""}
            >
              {contact.name}
              {contact.notifCount > 0 && <span className="notification">{contact.notifCount}</span>}
            </div>
          ))}
        </div>

        <div className="channels">
          <div className="section-header">
            <h2>Canali</h2>
            <div className="channel-buttons">
              <button onClick={() => setShowNewChannelModal(true)}>+</button>
              <button onClick={() => setShowPublicChannels(true)}>🔍</button>
            </div>
          </div>
          {channels.map((channel) => (
            <div
              key={channel.key}
              onClick={() => handleChannelSelect(channel.key)}
              className={`channel-item ${activeChannel === channel.key ? "active" : ""}`}
            >
              <span className="channel-name">{channel.name}</span>
              {channel.notifCount > 0 && (
                <span className="notification-badge">{channel.notifCount}</span>
              )}
            </div>
          ))}
        </div>

        <div className="announcements">
          <div className="section-header">
            <h2>Annunci</h2>
            <button onClick={() => setShowNewAnnouncementModal(true)}>+</button>
          </div>
          {announcements.map((announcement) => (
            <div
              key={announcement.key}
              onClick={() => handleAnnouncementSelect(announcement.key)}
              className={activeAnnouncement === announcement.key ? "active" : ""}
            >
              {announcement.name}
              {announcement.notifCount > 0 && <span className="notification">{announcement.notifCount}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="chat">
        <div className="messages">
          {messages.map((message, i) => (
            <div key={i} className="message">
              <span className="sender">{message.owner}: </span>
              <span className="text">{message.msg}</span>
            </div>
          ))}
        </div>

        <div className="input-area">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Scrivi un messaggio..."
          />
          <button onClick={handleSendMessage}>Invia</button>
        </div>
      </div>

      {showPublicKeyModal && <PublicKeyModal />}
      {showNewChannelModal && <NewChannelModal />}
      {showNewContactModal && <NewContactModal />}
      {showNewAnnouncementModal && <NewAnnouncementModal />}
      {showPublicChannels && <PublicChannelsList />}
    </div>
  );
};

export default App;
