import React, { useEffect, useState, useRef } from "react";
import { UnstoppableChat } from "@scobru/shogun";
import "./App.css";

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
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] =
    useState(false);
  const [newChannelForm, setNewChannelForm] = useState({
    name: "",
    isPrivate: false,
  });
  const [newContactForm, setNewContactForm] = useState({
    username: "",
    pubKey: "",
  });
  const [newAnnouncementForm, setNewAnnouncementForm] = useState({
    name: "",
    isPrivate: false,
    rssLink: "",
  });

  // Aggiungi stato per mostrare/nascondere il modal della chiave pubblica
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [userPublicKey, setUserPublicKey] = useState("");

  const [publicChannels, setPublicChannels] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPublicChannels, setShowPublicChannels] = useState(false);
  const [user, setUser] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    try {
      const superpeers = {
        peers: ["http://localhost:8765/gun"],
        localStorage: false,
        radisk: false,
      };

      const unstoppableChat = new UnstoppableChat(superpeers);
      setUser(unstoppableChat.gun.user().recall({ sessionStorage: true }));

      // Verifica più approfondita dell'istanza
      if (!unstoppableChat || !unstoppableChat.gun) {
        throw new Error("Errore nell'inizializzazione della chat");
      }

      // Inizializza Gun con le opzioni corrette
      unstoppableChat.gun.opt({
        peers: superpeers,
        localStorage: false,
        radisk: false,
      });

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

  // Modifica l'useEffect per la chiave pubblica
  useEffect(() => {
    if (user && user.is) {
      // Verifica più sicura
      try {
        const pub = user.is.pub;
        if (pub) {
          setUserPublicKey(pub);
        }
      } catch (error) {
        console.error("Errore nell'accesso alla chiave pubblica:", error);
      }
    }
  }, [chat, isLoggedIn]);

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
      await chat.gun
        .user()
        .create(authForm.username, authForm.password, (ack) => {
          if (ack.err) {
            setAuthError(ack.err);
            return;
          }
          // Procedi con il login dopo la registrazione
          handleLogin(e);
        });
    } catch (error) {
      setAuthError("Errore durante la registrazione: " + error.message);
    }
  };

  // Modifica la funzione handleLogin per gestire meglio l'autenticazione
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!chat?.gun) {
      setAuthError("Errore di inizializzazione della chat");
      return;
    }

    try {
      // Validazione input
      if (!authForm.username || !authForm.password || !authForm.publicName) {
        throw new Error("Tutti i campi sono obbligatori");
      }

      // Inizializza l'utente prima del join
      await new Promise((resolve, reject) => {
        user.auth(authForm.username, authForm.password, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await chat.join(
        authForm.username,
        authForm.password,
        authForm.publicName
      );
      setIsLoggedIn(true);
      setAuthError("");

      // Caricamento dati con gestione parallela
      const loadData = async () => {
        try {
          const [contactsStream, channelsStream, announcementsStream] =
            await Promise.all([
              chat.loadContacts(),
              chat.loadChannels(),
              chat.loadAnnouncements(),
            ]);

          // Gestione stream contatti
          if (contactsStream?.on) {
            contactsStream.on((contactsList) => {
              setContacts((prev) => {
                // Confronta e aggiorna solo se necessario
                if (JSON.stringify(prev) !== JSON.stringify(contactsList)) {
                  return contactsList;
                }
                return prev;
              });
            });
          }

          // Gestione stream canali
          if (channelsStream?.on) {
            channelsStream.on((channelsList) => {
              setChannels((prev) => {
                if (JSON.stringify(prev) !== JSON.stringify(channelsList)) {
                  return channelsList;
                }
                return prev;
              });
            });
          }

          // Gestione stream annunci
          if (announcementsStream?.on) {
            announcementsStream.on((announcementsList) => {
              setAnnouncements((prev) => {
                if (
                  JSON.stringify(prev) !== JSON.stringify(announcementsList)
                ) {
                  return announcementsList;
                }
                return prev;
              });
            });
          }
        } catch (error) {
          console.error("Errore nel caricamento dei dati:", error);
          setAuthError("Errore nel caricamento dei dati: " + error.message);
        }
      };

      loadData();
    } catch (error) {
      console.error("Errore durante il login:", error);
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
        <button type="submit">{isRegistering ? "Registrati" : "Accedi"}</button>
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

  // Nuova funzione per gestire i messaggi in modo unificato
  const handleMessageLoad = async (type, id, loadFunction) => {
    if (!chat || !id) return;

    try {
      const messageStream = await loadFunction();
      if (!messageStream?.on) {
        throw new Error("Stream messaggi non disponibile");
      }

      messageStream.on((newMessages) => {
        setMessages((prev) => {
          // Verifica se i messaggi sono effettivamente cambiati
          if (JSON.stringify(prev) === JSON.stringify(newMessages)) {
            return prev;
          }

          // Filtra i messaggi nulli o non validi
          const validMessages = newMessages.filter(
            (msg) => msg && msg.msg && msg.time !== undefined
          );

          // Ordina i messaggi per timestamp
          const sortedMessages = validMessages.sort(
            (a, b) => (a.time || 0) - (b.time || 0)
          );

          // Aggiungi metadati per il rendering
          return sortedMessages.map((msg) => ({
            ...msg,
            type,
            isOwn: msg.userPub === user.is.pub,
            time: msg.time || Date.now(), // Fallback al timestamp corrente se mancante
          }));
        });
      });
    } catch (error) {
      console.error(`Errore nel caricamento dei messaggi ${type}:`, error);
      setMessages([]);
    }
  };

  // Gestione invio messaggi
  const handleSendMessage = async () => {
    if (!chat || !newMessage) return;

    try {
      if (activeContact) {
        await chat.sendMessageToContact(activeContact, newMessage);
      } else if (activeChannel) {
        const channel = channels.find((c) => c.key === activeChannel);
        if (channel) {
          await chat.sendMessageToChannel(channel, newMessage, {
            pubKey: user.is.pub,
            alias: user.is.alias,
            name: chat.publicName,
            action: "message",
          });
        }
      } else if (activeAnnouncement) {
        const announcement = announcements.find(
          (a) => a.key === activeAnnouncement
        );
        if (announcement) {
          await chat.sendMessageToAnnouncement(announcement, newMessage, {
            pubKey: user.is.pub,
            alias: user.is.alias,
            name: chat.publicName,
            action: "message",
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

    const contact = contacts.find((c) => c.pubKey === pubKey);
    if (contact) {
      await handleMessageLoad("contact", pubKey, () =>
        chat.loadMessagesOfContact(pubKey)
      );
    }
  };

  // Gestione selezione canale
  const handleChannelSelect = async (channelKey) => {
    try {
      if (!chat) return;

      setActiveChannel(channelKey);

      // Trova il canale selezionato
      const selectedChannel =
        channels.find((c) => c.key === channelKey) ||
        publicChannels.find((c) => c.key === channelKey);

      if (!selectedChannel) {
        console.error("Canale non trovato");
        return;
      }

      // Carica i messaggi del canale
      const messageStream = await chat.loadMessagesOfChannel(selectedChannel);
      messageStream.on((messages) => {
        setMessages(messages);
      });
    } catch (error) {
      console.error("Errore nella selezione del canale:", error);
    }
  };

  // Gestione selezione annuncio
  const handleAnnouncementSelect = async (announcementKey) => {
    setActiveAnnouncement(announcementKey);
    setActiveContact(null);
    setActiveChannel(null);

    const announcement = announcements.find((a) => a.key === announcementKey);
    if (announcement && chat) {
      try {
        const messageStream = await chat.loadMessagesOfAnnouncement(
          announcement
        );
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

  // Funzione migliorata per la creazione di canali
  const handleCreateChannel = async (e) => {
    e.preventDefault();

    try {
      // Validazione
      if (!newChannelForm.name.trim()) {
        throw new Error("Il nome del canale è obbligatorio");
      }

      // Verifica duplicati
      const channelExists = channels.some(
        (c) => c.name.toLowerCase() === newChannelForm.name.toLowerCase()
      );
      if (channelExists) {
        throw new Error("Esiste già un canale con questo nome");
      }

      const channel = await chat.createChannel(
        newChannelForm.name.trim(),
        newChannelForm.isPrivate
      );

      // Aggiorna i canali solo se necessario
      setChannels((prev) => {
        const updated = [...prev, channel];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });

      // Reset form e chiudi modal
      setNewChannelForm({ name: "", isPrivate: false });
      setShowNewChannelModal(false);

      // Seleziona automaticamente il nuovo canale
      handleChannelSelect(channel.key);
    } catch (error) {
      console.error("Errore nella creazione del canale:", error);
      setAuthError(error.message);
    }
  };

  // Gestione aggiunta contatto
  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!chat || !chat.gun || !user.is) {
      setAuthError("Chat non inizializzata correttamente");
      return;
    }

    try {
      // Applica trim() qui, al momento dell'invio
      const username = newContactForm.username.trim();
      const pubKey = newContactForm.pubKey.trim();

      // Verifica che tutti i campi siano presenti
      if (!username || !pubKey) {
        throw new Error("Tutti i campi sono obbligatori");
      }

      // Verifica formato della chiave pubblica
      if (!pubKey.match(/^[A-Za-z0-9._-]+$/)) {
        throw new Error("Formato chiave pubblica non valido");
      }

      // Verifica che non si stia aggiungendo se stessi
      if (pubKey === user.is.pub) {
        throw new Error("Non puoi aggiungere te stesso come contatto");
      }

      // Verifica che il contatto non esista già
      const existingContact = contacts.find((c) => c.pubKey === pubKey);
      if (existingContact) {
        throw new Error("Contatto già presente");
      }

      // Aggiungi il contatto
      const contact = await chat.addContact(username, pubKey);

      // Aggiorna la lista dei contatti
      setContacts((prevContacts) => [...prevContacts, contact]);
      setShowNewContactModal(false);
      setNewContactForm({ username: "", pubKey: "" });
      setAuthError("");
    } catch (error) {
      console.error("Errore nell'aggiunta del contatto:", error);
      setAuthError(error.message);
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
      setNewAnnouncementForm({ name: "", isPrivate: false, rssLink: "" });
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
            onChange={(e) =>
              setNewChannelForm({ ...newChannelForm, name: e.target.value })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={newChannelForm.isPrivate}
              onChange={(e) =>
                setNewChannelForm({
                  ...newChannelForm,
                  isPrivate: e.target.checked,
                })
              }
            />
            Privato
          </label>
          <button type="submit">Crea</button>
          <button type="button" onClick={() => setShowNewChannelModal(false)}>
            Annulla
          </button>
        </form>
      </div>
    </div>
  );

  const NewContactModal = () => (
    <div className="modal">
      <div className="modal-content">
        <h3>Aggiungi nuovo contatto</h3>
        {authError && (
          <div
            className="error-message"
            style={{ color: "red", marginBottom: "10px" }}
          >
            {authError}
          </div>
        )}
        <form onSubmit={handleAddContact}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Inserisci username"
              value={newContactForm.username}
              onChange={(e) =>
                setNewContactForm({
                  ...newContactForm,
                  username: e.target.value,
                })
              }
              required
              autoComplete="off"
              style={{ marginBottom: "10px", width: "100%", padding: "8px" }}
            />
          </div>
          <div className="input-group">
            <label htmlFor="pubkey">Chiave pubblica</label>
            <input
              id="pubkey"
              type="text"
              placeholder="Inserisci chiave pubblica"
              value={newContactForm.pubKey}
              onChange={(e) =>
                setNewContactForm({
                  ...newContactForm,
                  pubKey: e.target.value,
                })
              }
              required
              autoComplete="off"
              style={{ marginBottom: "10px", width: "100%", padding: "8px" }}
            />
          </div>
          <div
            className="modal-buttons"
            style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={() => {
                setShowNewContactModal(false);
                setAuthError("");
                setNewContactForm({ username: "", pubKey: "" });
              }}
              style={{ padding: "8px 16px" }}
            >
              Annulla
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
              }}
            >
              Aggiungi
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
            onChange={(e) =>
              setNewAnnouncementForm({
                ...newAnnouncementForm,
                name: e.target.value,
              })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={newAnnouncementForm.isPrivate}
              onChange={(e) =>
                setNewAnnouncementForm({
                  ...newAnnouncementForm,
                  isPrivate: e.target.checked,
                })
              }
            />
            Privato
          </label>
          <input
            type="text"
            placeholder="RSS Link (opzionale)"
            value={newAnnouncementForm.rssLink}
            onChange={(e) =>
              setNewAnnouncementForm({
                ...newAnnouncementForm,
                rssLink: e.target.value,
              })
            }
          />
          <button type="submit">Crea</button>
          <button
            type="button"
            onClick={() => setShowNewAnnouncementModal(false)}
          >
            Annulla
          </button>
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
          <p>Username: {user?.is?.alias || authForm.username}</p>
          <p>Chiave Pubblica: {userPublicKey}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(userPublicKey);
            }}
          >
            Copia Chiave
          </button>
        </div>
        <button onClick={() => setShowPublicKeyModal(false)}>Chiudi</button>
      </div>
    </div>
  );

  // Funzione per entrare in un canale pubblico
  const handleJoinPublicChannel = async (channel) => {
    try {
      if (!chat || !user.is) {
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
        disabled: false,
      };

      // Aggiorna manualmente la lista dei canali
      setChannels((prevChannels) => {
        // Verifica se il canale esiste già
        const existingChannel = prevChannels.find((c) => c.key === channel.key);
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
            .filter((channel) =>
              channel.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((channel) => (
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

  // Modifica handleAcceptContactInvite
  const handleAcceptContactInvite = async (pubKey) => {
    try {
      await chat.acceptContactInvite(pubKey);
      // Aggiorna la lista dei contatti
      const contactsStream = chat.loadContacts();
      if (contactsStream?.on) {
        contactsStream.on((contactsList) => {
          setContacts(contactsList);
        });
      }
    } catch (error) {
      console.error("Errore nell'accettazione dell'invito:", error);
      setAuthError(error.message);
    }
  };

  // Nuovo componente per il rendering dei messaggi
  const MessageList = ({ messages, currentUser }) => {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
      scrollToBottom();
    }, [messages]);

    // Funzione per formattare la data
    const formatMessageTime = (timestamp) => {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <div className="messages">
        {messages.map((message, i) => (
          <div
            key={`${message.time}-${i}`}
            className={`message ${message.isOwn ? "own" : ""} ${
              message.peerInfo?.action ? "system" : ""
            }`}
          >
            <div className="message-header">
              <span className="sender">{message.owner || "Sconosciuto"}</span>
              {message.time && (
                <span className="time">{formatMessageTime(message.time)}</span>
              )}
            </div>
            <div className="message-content">
              {message.link ? (
                <a
                  href={message.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="message-link"
                >
                  {message.msg}
                </a>
              ) : (
                <span>{message.msg}</span>
              )}
            </div>
            {message.peerInfo?.action && (
              <div className="system-message">
                {message.peerInfo.action === "join" &&
                  `${message.peerInfo.name} è entrato nel canale`}
                {message.peerInfo.action === "leave" &&
                  `${message.peerInfo.name} ha lasciato il canale`}
                {message.peerInfo.action === "message" && message.msg}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

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
              {contact.notifCount > 0 && (
                <span className="notification">{contact.notifCount}</span>
              )}
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
              className={`channel-item ${
                activeChannel === channel.key ? "active" : ""
              }`}
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
              className={
                activeAnnouncement === announcement.key ? "active" : ""
              }
            >
              {announcement.name}
              {announcement.notifCount > 0 && (
                <span className="notification">{announcement.notifCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chat">
        <MessageList messages={messages} currentUser={user.is.pub} />

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
