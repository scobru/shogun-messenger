// App.js
import React, { useEffect, useState, useRef } from "react";
import { UnstoppableChat } from "@scobru/shogun"; // Importa la classe dal protocollo
import "./App.css";

const App = () => {
  // Stato per la chat e l'autenticazione
  const [chat, setChat] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    username: "",
    password: "",
    publicName: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Stati per i dati della chat
  const [contacts, setContacts] = useState([]);
  const [contactInvites, setContactInvites] = useState([]);
  const [channels, setChannels] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [publicChannels, setPublicChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Stato per l'elemento attivo (contatto, canale, annuncio)
  const [activeContact, setActiveContact] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

  // Stati per la visualizzazione dei modali
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] =
    useState(false);
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [showPublicChannels, setShowPublicChannels] = useState(false);

  // Form per creazione di canali, contatti e annunci
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

  // Altri stati
  const [userPublicKey, setUserPublicKey] = useState("");
  const [user, setUser] = useState(null);
  const [hasNewInvites, setHasNewInvites] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Ref per lo scroll dei messaggi
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inizializzazione della chat (UnstoppableChat) al mount dell'app
  useEffect(() => {
    const superpeers = "http://localhost:8765/gun";
    try {
      const chatInstance = new UnstoppableChat(superpeers);
      setChat(chatInstance);
      // Riprendi l'utente dalla sessione (se esistente)
      const currentUser = chatInstance.gun
        .user()
        .recall({ sessionStorage: true });
      setUser(currentUser);
    } catch (error) {
      console.error("Errore nell'inizializzazione della chat:", error);
      setAuthError("Errore nella connessione al server");
    }
  }, []);

  // Carica i canali pubblici (utilizza il metodo del protocollo)
  useEffect(() => {
    if (!chat) return;
    const publicStream = chat.loadPublicChannels();
    publicStream.on((channelList) => {
      setPublicChannels(channelList);
    });
  }, [chat]);

  // Aggiorna la chiave pubblica se disponibile
  useEffect(() => {
    if (user && user.is) {
      setUserPublicKey(user.is.pub);
    }
  }, [user, isLoggedIn]);

  // Carica gli inviti contatto
  useEffect(() => {
    if (!chat || !user?.is) return;
    const invitesStream = chat.loadContactInvites();
    if (invitesStream?.on) {
      invitesStream.on((invites) => {
        if (!Array.isArray(invites)) return;
        
        // Filtra solo gli inviti attivi
        const activeInvites = invites.filter(invite => 
          invite && !invite.disabled && invite.pubKey !== user.is.pub
        );

        setContactInvites(activeInvites);
        
        // Imposta il flag per le nuove notifiche
        if (activeInvites.length > 0) {
          setHasNewInvites(true);
          // Mostra una notifica del browser
          if (Notification.permission === "granted") {
            const lastInvite = activeInvites[activeInvites.length - 1];
            new Notification("Nuovo invito di contatto", {
              body: `Hai ricevuto un nuovo invito da ${lastInvite.name || lastInvite.alias || 'un utente'}`
            });
          }
        }
      });
    }
  }, [chat, user]);

  // Aggiungi questo useEffect per monitorare i contatti
  useEffect(() => {
    if (isLoggedIn && chat && user?.is) {
      const contactsStream = chat.loadContacts();
      if (contactsStream?.on) {
        contactsStream.on((contactsList) => {
          if (!contactsList) return;
          
          const filteredContacts = contactsList.filter(contact => 
            contact && 
            !contact.disabled && 
            contact.pubKey !== user.is.pub
          );
          setContacts(filteredContacts);
        });
      }
    }
  }, [isLoggedIn, chat, user]);

  // Gestione input del form di autenticazione
  const handleAuthInputChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  // Registrazione utente
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
          // Dopo la registrazione, esegui il login
          handleLogin(e);
        });
    } catch (error) {
      setAuthError("Errore durante la registrazione: " + error.message);
    }
  };

  // Login utente
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!chat) return;

    try {
      await chat.join(authForm.username, authForm.password, authForm.publicName);
      
      // Prima imposta l'utente e poi il login
      const currentUser = chat.gun.user().recall({ sessionStorage: true });
      setUser(currentUser);
      setIsLoggedIn(true);
      setAuthError("");
      
      // Carica i contatti dopo che l'utente è stato impostato
      const contactsStream = chat.loadContacts();
      if (contactsStream?.on) {
        contactsStream.on((contactsList) => {
          if (!contactsList) return;
          
          const filteredContacts = contactsList.filter(contact => 
            contact && 
            !contact.disabled && 
            contact.pubKey !== currentUser.is.pub
          );
          setContacts(filteredContacts);
        });
      }

      // Carica i canali
      const channelsStream = await chat.loadChannels();
      if (channelsStream?.on) {
        channelsStream.on((channelsList) => setChannels(channelsList));
      }

      // Carica gli annunci
      const announcementsStream = await chat.loadAnnouncements();
      if (announcementsStream?.on) {
        announcementsStream.on((announcementsList) =>
          setAnnouncements(announcementsList)
        );
      }

      // Aggiorna lo stato utente
      setUser(chat.gun.user().recall({ sessionStorage: true }));
    } catch (error) {
      console.error("Errore durante il login:", error);
      setAuthError("Errore durante il login: " + error.message);
    }
  };

  // Logout utente
  const handleLogout = async () => {
    try {
      if (chat) {
        await chat.logout();
        chat.reset();
      }
      setIsLoggedIn(false);
      setContacts([]);
      setChannels([]);
      setAnnouncements([]);
      setMessages([]);
      setActiveContact(null);
      setActiveChannel(null);
      setActiveAnnouncement(null);
      setAuthForm({ username: "", password: "", publicName: "" });
      setAuthError("");
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  };

  // Selezione contatto: carica i messaggi tramite il metodo del protocollo
  const handleContactSelect = async (pubKey) => {
    try {
      setActiveContact(pubKey);
      setActiveChannel(null);
      setActiveAnnouncement(null);
      
      const contact = contacts.find((c) => c.pubKey === pubKey);
      if (!contact || !chat) return;

      // Carica i messaggi del contatto
      const messageStream = await chat.loadMessagesOfContact(pubKey, contact.name);
      if (messageStream?.on) {
        messageStream.on((msgs) => {
          // Filtra e formatta i messaggi
          const formattedMessages = msgs
            .filter(msg => msg && msg.msg) // Filtra messaggi validi
            .map(msg => ({
              ...msg,
              isOwn: msg.userPub === user.is.pub,
              owner: msg.userPub === user.is.pub ? 'Tu' : contact.name || contact.alias || 'Utente',
              time: msg.time || Date.now()
            }))
            .sort((a, b) => a.time - b.time); // Ordina per timestamp

          setMessages(formattedMessages);
        });
      }
    } catch (error) {
      console.error("Errore nel caricamento dei messaggi:", error);
      setMessages([]);
    }
  };

  // Selezione canale
  const handleChannelSelect = async (channelKey) => {
    setActiveChannel(channelKey);
    setActiveContact(null);
    setActiveAnnouncement(null);
    const selectedChannel =
      channels.find((c) => c.key === channelKey) ||
      publicChannels.find((c) => c.key === channelKey);
    if (!selectedChannel) return;
    try {
      const messageStream = await chat.loadMessagesOfChannel(selectedChannel);
      if (messageStream?.on) {
        messageStream.on((msgs) => {
          const formatted = msgs.map((msg) => ({
            ...msg,
            isOwn: msg.userPub === user.is.pub,
            time: msg.time || Date.now(),
          }));
          setMessages(formatted);
        });
      }
    } catch (error) {
      console.error("Errore nel caricamento dei messaggi del canale:", error);
    }
  };

  // Selezione annuncio
  const handleAnnouncementSelect = async (announcementKey) => {
    setActiveAnnouncement(announcementKey);
    setActiveContact(null);
    setActiveChannel(null);
    const selectedAnnouncement = announcements.find(
      (a) => a.key === announcementKey
    );
    if (!selectedAnnouncement) return;
    try {
      const messageStream = await chat.loadMessagesOfAnnouncement(
        selectedAnnouncement
      );
      if (messageStream?.on) {
        messageStream.on((msgs) => {
          const formatted = msgs.map((msg) => ({
            ...msg,
            isOwn: msg.userPub === user.is.pub,
            time: msg.time || Date.now(),
          }));
          setMessages(formatted);
        });
      }
    } catch (error) {
      console.error(
        "Errore nel caricamento dei messaggi dell'annuncio:",
        error
      );
    }
  };

  // Invio messaggio (a contatto, canale o annuncio in base alla selezione)
  const handleSendMessage = async () => {
    if (!chat || !newMessage.trim()) return;

    try {
      if (activeContact) {
        await chat.sendMessageToContact(activeContact, newMessage);
      } else if (activeChannel) {
        const channel = channels.find((c) => c.key === activeChannel);
        if (channel) {
          await chat.sendMessageToChannel(channel, newMessage, {
            pubKey: user.is.pub,
            alias: user.is.alias,
            name: authForm.publicName,
            action: "message",
          });
        }
      } else if (activeAnnouncement) {
        const announcement = announcements.find((a) => a.key === activeAnnouncement);
        if (announcement) {
          await chat.sendMessageToAnnouncement(announcement, newMessage, {
            pubKey: user.is.pub,
            alias: user.is.alias,
            name: authForm.publicName,
            action: "message",
          });
        }
      }
      setNewMessage("");
    } catch (error) {
      console.error("Errore nell'invio del messaggio:", error);
    }
  };

  // Creazione di un nuovo canale
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    try {
      if (!newChannelForm.name.trim())
        throw new Error("Il nome del canale è obbligatorio");
      const exists = channels.some(
        (c) => c.name.toLowerCase() === newChannelForm.name.toLowerCase()
      );
      if (exists) throw new Error("Esiste già un canale con questo nome");
      const newChannel = await chat.createChannel(
        newChannelForm.name.trim(),
        newChannelForm.isPrivate
      );
      setChannels((prev) =>
        [...prev, newChannel].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewChannelForm({ name: "", isPrivate: false });
      setShowNewChannelModal(false);
      // Seleziona il nuovo canale
      handleChannelSelect(newChannel.key);
    } catch (error) {
      console.error("Errore nella creazione del canale:", error);
      setAuthError(error.message);
    }
  };

  // Aggiunta di un nuovo contatto
  const handleAddContact = async () => {
    try {
      if (!chat || !user?.is) {
        throw new Error("Chat non inizializzata correttamente");
      }

      const username = newContactForm.username.trim();
      const pubKey = newContactForm.pubKey.trim();

      // Validazioni
      if (!username || !pubKey) {
        throw new Error("Username e chiave pubblica sono obbligatori");
      }

      if (pubKey === user.is.pub) {
        throw new Error("Non puoi aggiungere te stesso come contatto");
      }

      // Verifica se il contatto esiste già
      const existingContact = contacts.find(c => c.pubKey === pubKey);
      if (existingContact) {
        throw new Error("Contatto già presente");
      }

      // Invia l'invito al contatto
      await chat.addContact(username, pubKey, authForm.publicName);
      
      setShowNewContactModal(false);
      setNewContactForm({ username: "", pubKey: "" });
      setAuthError("");
      
    } catch (error) {
      console.error("Errore nell'aggiunta del contatto:", error);
      setAuthError(error.message);
    }
  };

  // Creazione di un nuovo annuncio
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const announcement = await chat.createAnnouncement(
        newAnnouncementForm.name,
        newAnnouncementForm.isPrivate,
        newAnnouncementForm.rssLink
      );
      setAnnouncements((prev) => [...prev, announcement]);
      setNewAnnouncementForm({ name: "", isPrivate: false, rssLink: "" });
      setShowNewAnnouncementModal(false);
    } catch (error) {
      console.error("Errore nella creazione dell'annuncio:", error);
    }
  };

  // Entrare in un canale pubblico
  const handleJoinPublicChannel = async (channel) => {
    try {
      if (!chat || !user?.is) return;
      await chat.joinPublicChannel(channel);
      // Aggiorna la lista dei canali (se non già presente)
      setChannels((prev) => {
        const exists = prev.find((c) => c.key === channel.key);
        return exists ? prev : [...prev, channel];
      });
      setActiveChannel(channel.key);
      setActiveContact(null);
      setActiveAnnouncement(null);
      // Carica i messaggi del canale
      const messageStream = await chat.loadMessagesOfChannel(channel);
      if (messageStream?.on) {
        messageStream.on((msgs) => {
          const formatted = msgs.map((msg) => ({
            ...msg,
            isOwn: msg.userPub === user.is.pub,
            time: msg.time || Date.now(),
          }));
          setMessages(formatted);
        });
      }
      setShowPublicChannels(false);
    } catch (error) {
      console.error("Errore nell'entrare nel canale pubblico:", error);
    }
  };

  // Accetta un invito di contatto
  const handleAcceptInvite = async (invite) => {
    try {
      if (!invite.pubKey || !invite.name) {
        throw new Error("Dati invito non validi");
      }

      await chat.acceptContactInvite(
        invite.name, // username
        invite.pubKey, // pubKey
        authForm.publicName // il tuo nome pubblico
      );

      // Rimuovi l'invito dalla lista
      setContactInvites(prev => prev.filter(inv => inv.pubKey !== invite.pubKey));
      
      // Aggiorna la lista dei contatti
      const contactsStream = chat.loadContacts();
      if (contactsStream?.on) {
        contactsStream.on((contactsList) => {
          const filteredContacts = contactsList.filter(c => 
            c && !c.disabled && c.pubKey !== user.is.pub
          );
          setContacts(filteredContacts);
        });
      }

    } catch (error) {
      console.error("Errore nell'accettazione dell'invito:", error);
      setAuthError(error.message);
    }
  };

  // Rifiuta un invito di contatto
  const handleDenyInvite = async (pubKey) => {
    try {
      await chat.denyContactInvite(pubKey);
      setContactInvites((prev) => prev.filter((inv) => inv.pubKey !== pubKey));
    } catch (error) {
      console.error("Errore nel rifiuto dell'invito:", error);
      setAuthError(error.message);
    }
  };

  // Copia la chiave pubblica negli appunti
  const handleCopyPublicKey = () => {
    navigator.clipboard
      .writeText(userPublicKey)
      .then(() => {
        // Feedback opzionale
      })
      .catch((err) => console.error("Errore nella copia della chiave:", err));
  };

  // Componente per il rendering dei messaggi
  const MessageList = ({ messages }) => {
    const formatTime = (timestamp) => {
      if (!timestamp) return "";
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <div className="messages">
        {messages.map((msg, i) => (
          <div
            key={`${msg.time}-${i}`}
            className={`message ${msg.isOwn ? "own" : ""} ${
              msg.peerInfo?.action ? "system" : ""
            }`}
          >
            <div className="message-header">
              <span className="sender">
                {msg.owner || (msg.isOwn ? "Tu" : "Utente")}
              </span>
              <span className="time">{formatTime(msg.time)}</span>
            </div>
            <div className="message-content">
              {msg.link ? (
                <a href={msg.link} target="_blank" rel="noopener noreferrer">
                  {msg.msg}
                </a>
              ) : (
                <span>{msg.msg}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  // Form di autenticazione (se l'utente non è loggato)
  const renderAuthForm = () => (
    <div className="auth-container">
      <h2>{isRegistering ? "Registrazione" : "Login"}</h2>
      <form onSubmit={isRegistering ? handleRegister : handleLogin}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={authForm.username}
          onChange={handleAuthInputChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={authForm.password}
          onChange={handleAuthInputChange}
          required
        />
        <input
          type="text"
          name="publicName"
          placeholder="Nome Pubblico"
          value={authForm.publicName}
          onChange={handleAuthInputChange}
          required
        />
        {authError && <div className="error">{authError}</div>}
        <button type="submit">{isRegistering ? "Registrati" : "Accedi"}</button>
      </form>
      <button onClick={() => setIsRegistering(!isRegistering)}>
        {isRegistering
          ? "Hai già un account? Accedi"
          : "Non hai un account? Registrati"}
      </button>
    </div>
  );

  return (
    <div className="app">
      {!isLoggedIn ? (
        renderAuthForm()
      ) : (
        <>
          {/* Sidebar con informazioni utente, contatti, canali e annunci */}
          <div className="sidebar">
            <div className="user-info">
              <span>Benvenuto, {authForm.publicName}</span>
              <button onClick={() => setShowPublicKeyModal(true)}>
                Mostra Chiave
              </button>
              {hasNewInvites && (
                <button 
                  className="invites-btn"
                  onClick={() => {
                    setShowInvitesModal(true);
                    setHasNewInvites(false);
                  }}
                >
                  Inviti ({contactInvites.length})
                </button>
              )}
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
                  className={`contact-item ${
                    activeContact === contact.pubKey ? "active" : ""
                  }`}
                  onClick={() => handleContactSelect(contact.pubKey)}
                >
                  <span>{contact.name || contact.alias || "Sconosciuto"}</span>
                  {contact.notifCount > 0 && (
                    <span className="notification">{contact.notifCount}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="channels">
              <div className="section-header">
                <h2>Canali</h2>
                <button onClick={() => setShowNewChannelModal(true)}>+</button>
                <button onClick={() => setShowPublicChannels(true)}>🔍</button>
              </div>
              {channels.map((channel) => (
                <div
                  key={channel.key}
                  className={`channel-item ${
                    activeChannel === channel.key ? "active" : ""
                  }`}
                  onClick={() => handleChannelSelect(channel.key)}
                >
                  {channel.name}
                  {channel.notifCount > 0 && (
                    <span className="notification">{channel.notifCount}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="announcements">
              <div className="section-header">
                <h2>Annunci</h2>
                <button onClick={() => setShowNewAnnouncementModal(true)}>
                  +
                </button>
              </div>
              {announcements.map((announcement) => (
                <div
                  key={announcement.key}
                  className={`announcement-item ${
                    activeAnnouncement === announcement.key ? "active" : ""
                  }`}
                  onClick={() => handleAnnouncementSelect(announcement.key)}
                >
                  {announcement.name}
                </div>
              ))}
            </div>
          </div>

          {/* Area chat: messaggi e input */}
          <div className="chat">
            <MessageList messages={messages} />
            <div className="input-area">
              <input
                type="text"
                placeholder="Scrivi un messaggio..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button onClick={handleSendMessage}>Invia</button>
            </div>
          </div>

          {/* Modali */}
          {showPublicKeyModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>La tua chiave pubblica</h3>
                <p>{userPublicKey}</p>
                <button onClick={handleCopyPublicKey}>Copia Chiave</button>
                <button onClick={() => setShowPublicKeyModal(false)}>
                  Chiudi
                </button>
              </div>
            </div>
          )}

          {showNewContactModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Aggiungi Contatto</h3>
                <input
                  type="text"
                  placeholder="Username"
                  value={newContactForm.username}
                  onChange={(e) =>
                    setNewContactForm({
                      ...newContactForm,
                      username: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Chiave Pubblica"
                  value={newContactForm.pubKey}
                  onChange={(e) =>
                    setNewContactForm({
                      ...newContactForm,
                      pubKey: e.target.value,
                    })
                  }
                />
                <button onClick={handleAddContact}>Aggiungi</button>
                <button onClick={() => setShowNewContactModal(false)}>
                  Annulla
                </button>
                {authError && <div className="error">{authError}</div>}
              </div>
            </div>
          )}

          {showInvitesModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Inviti in sospeso</h3>
                {contactInvites.length === 0 ? (
                  <p>Nessun invito in sospeso</p>
                ) : (
                  <div className="invites-list">
                    {contactInvites.map((invite) => (
                      <div key={invite.pubKey} className="invite-item">
                        <div className="invite-info">
                          <span className="invite-name">
                            {invite.name || invite.alias || 'Utente sconosciuto'}
                          </span>
                        </div>
                        <div className="invite-actions">
                          <button 
                            onClick={() => handleAcceptInvite(invite)}
                            className="accept-btn"
                          >
                            Accetta
                          </button>
                          <button 
                            onClick={() => handleDenyInvite(invite.pubKey)}
                            className="deny-btn"
                          >
                            Rifiuta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowInvitesModal(false)}>Chiudi</button>
              </div>
            </div>
          )}

          {showNewChannelModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Crea Nuovo Canale</h3>
                <input
                  type="text"
                  placeholder="Nome Canale"
                  value={newChannelForm.name}
                  onChange={(e) =>
                    setNewChannelForm({
                      ...newChannelForm,
                      name: e.target.value,
                    })
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
                <button onClick={handleCreateChannel}>Crea</button>
                <button onClick={() => setShowNewChannelModal(false)}>
                  Annulla
                </button>
              </div>
            </div>
          )}

          {showPublicChannels && (
            <div className="modal">
              <div className="modal-content">
                <h3>Canali Pubblici</h3>
                <input
                  type="text"
                  placeholder="Cerca Canali..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="public-channels-list">
                  {publicChannels
                    .filter((channel) =>
                      channel.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                    )
                    .map((channel) => (
                      <div key={channel.key} className="public-channel-item">
                        <span>{channel.name}</span>
                        <button
                          onClick={() => handleJoinPublicChannel(channel)}
                        >
                          Entra
                        </button>
                      </div>
                    ))}
                </div>
                <button onClick={() => setShowPublicChannels(false)}>
                  Chiudi
                </button>
              </div>
            </div>
          )}

          {showNewAnnouncementModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Crea Annuncio</h3>
                <input
                  type="text"
                  placeholder="Nome Annuncio"
                  value={newAnnouncementForm.name}
                  onChange={(e) =>
                    setNewAnnouncementForm({
                      ...newAnnouncementForm,
                      name: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Link RSS (opzionale)"
                  value={newAnnouncementForm.rssLink}
                  onChange={(e) =>
                    setNewAnnouncementForm({
                      ...newAnnouncementForm,
                      rssLink: e.target.value,
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
                <button onClick={handleCreateAnnouncement}>Crea</button>
                <button onClick={() => setShowNewAnnouncementModal(false)}>
                  Annulla
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
