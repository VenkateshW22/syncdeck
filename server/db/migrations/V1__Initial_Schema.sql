CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    room_code VARCHAR(10) UNIQUE NOT NULL,
    host_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    persist_on_close BOOLEAN DEFAULT FALSE,
    waiting_room_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE participants (
    id UUID PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    ip_hash VARCHAR(255),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE resources (
    id UUID PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    created_by UUID REFERENCES participants(id),
    title VARCHAR(255),
    description TEXT,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    room_id UUID REFERENCES rooms(id),
    action VARCHAR(255) NOT NULL,
    details JSONB,
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rooms_room_code ON rooms(room_code);
CREATE INDEX idx_participants_room_id ON participants(room_id);
CREATE INDEX idx_resources_room_id ON resources(room_id);
